import {
  AccountingJournalBatchStatus,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  BankReconciliationStatus,
  BookingMatchSource,
  BookingPaymentClearingStatus,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  EarningStatus,
  MonthlyTaxClosingStatus,
  ParticipantStatus,
  PaymentStatus,
  PaymentFeePayer,
  PaymentFeeTreatment,
  PaymentMethod,
  ProviderBankAccountStatus,
  ProviderKycStatus,
  ProviderReportSeverity,
  ProviderReportStatus,
  ProviderSanctionStatus,
  ProviderStatus,
  ProviderTaxProfileStatus,
  ProviderWalletLedgerType,
  CustomerWalletLedgerType,
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralRewardMode,
  ReferralRewardStatus,
  Role,
} from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_LOCALES,
} from '../notifications/notification-template-catalog';
import { ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT } from './admin-booking-detail-selects';
import { ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT } from './admin-booking-selects';
import { AdminService } from './admin.service';

const creditedReferralRewardStatus = 'CREDITED' as ReferralRewardStatus;
const cashoutApprovedReferralRewardStatus = 'CASHOUT_APPROVED' as ReferralRewardStatus;
const paidReferralRewardStatus = 'PAID' as ReferralRewardStatus;
const taxReviewRequiredReferralRewardStatus = 'TAX_REVIEW_REQUIRED' as ReferralRewardStatus;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

function createAdminService(
  prisma: unknown,
  deps: { earnings?: unknown; notifications?: unknown; referrals?: unknown } = {},
) {
  return new AdminService(
    prisma as never,
    (deps.earnings ?? {}) as never,
    (deps.notifications ?? {}) as never,
    {} as never,
    {} as never,
    (deps.referrals ?? {}) as never,
  );
}

describe('AdminService query orchestration', () => {
  it('bounds the admin user list used by the operations dashboard', async () => {
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listUsers()).resolves.toEqual([]);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
  });

  it('applies admin user list pagination when requested by dashboard diagnostics', async () => {
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listUsers({ skip: '100', take: '50' })).resolves.toEqual([]);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        skip: 100,
        take: 50,
      }),
    );
  });

  it('filters operational policy settings by requested keys before returning definitions', async () => {
    const prisma = {
      operationalPolicySetting: {
        findMany: vi.fn().mockResolvedValue([
          {
            key: 'notification.partner_alert_channel',
            value: 'FCM_FOR_ALL_BOOKINGS',
            updatedAt: new Date('2026-06-20T00:00:00.000Z'),
            updatedBy: { id: 'admin-1', phone: '+84000000000', fullName: 'Ops Admin' },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listOperationalPolicySettings({
        keys: 'notification.partner_alert_channel,booking.max_customer_current_to_booking_address_km',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        key: 'booking.max_customer_current_to_booking_address_km',
      }),
      expect.objectContaining({
        key: 'notification.partner_alert_channel',
        value: 'FCM_FOR_ALL_BOOKINGS',
      }),
    ]);

    expect(prisma.operationalPolicySetting.findMany).toHaveBeenCalledWith({
      include: { updatedBy: { select: { id: true, phone: true, fullName: true } } },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
      where: {
        key: {
          in: ['notification.partner_alert_channel', 'booking.max_customer_current_to_booking_address_km'],
        },
      },
    });
  });

  it('keeps audit log list bounded by default', async () => {
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listAuditLogs()).resolves.toEqual([]);

    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: expect.objectContaining({
        action: true,
        actor: expect.any(Object),
        createdAt: true,
        metadata: true,
        target: true,
      }),
    });
  });

  it('keeps customer detail audit trail bounded to the visible preview', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'customer-1',
          userId: 'user-1',
        }),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([{ id: 'audit-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getCustomerDetail('customer-1')).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [{ id: 'audit-1' }],
      }),
    );

    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 10,
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { target: 'customer:customer-1' },
            { target: 'user:user-1' },
          ]),
        }),
      }),
    );
  });

  it('keeps provider report lists bounded for operations pages', async () => {
    const prisma = {
      providerReport: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listProviderReports({ take: '5' })).resolves.toEqual([]);

    expect(prisma.providerReport.findMany).toHaveBeenCalledWith({
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: expect.any(Object),
    });
  });

  it('keeps provider sanction lists bounded for operations pages', async () => {
    const prisma = {
      providerSanction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listProviderSanctions({ take: '8' })).resolves.toEqual([]);

    expect(prisma.providerSanction.findMany).toHaveBeenCalledWith({
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      take: 8,
      select: expect.any(Object),
    });
  });

  it('filters app sessions server-side and clamps requested limits', async () => {
    const prisma = {
      appSession: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listAppSessions({
        platform: ' IOS ',
        q: '8490',
        role: 'customer',
        skip: '20',
        state: 'live',
        take: '250',
      }),
    ).resolves.toEqual([]);

    expect(prisma.appSession.findMany).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          { role: 'CUSTOMER' },
          { platform: { equals: 'IOS', mode: 'insensitive' } },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { active: true, expiresAt: { gte: expect.any(Date) } },
              { lastSeenAt: { gte: expect.any(Date) } },
            ]),
          }),
          {
            OR: [
              { user: { phone: { contains: '8490', mode: 'insensitive' } } },
              { user: { fullName: { contains: '8490', mode: 'insensitive' } } },
              { deviceId: { contains: '8490', mode: 'insensitive' } },
              { ipAddress: { contains: '8490', mode: 'insensitive' } },
            ],
          },
        ]),
      },
      orderBy: { lastSeenAt: 'desc' },
      skip: 20,
      take: 50,
      select: expect.any(Object),
    });
  });

  it('summarizes app sessions with aggregate counts instead of full session hydration', async () => {
    const prisma = {
      appSession: {
        count: vi
          .fn()
          .mockResolvedValueOnce(120)
          .mockResolvedValueOnce(11)
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(2),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.appSessionSummary({
        platform: 'IOS',
        q: '8490',
        state: 'live',
      }),
    ).resolves.toMatchObject({
      expired: 2,
      liveCustomers: 11,
      livePartners: 7,
      recentCustomers: 4,
      recentPartners: 1,
      recent: 5,
      stale: 3,
      totalCount: 120,
    });

    expect(prisma.appSession.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { platform: { equals: 'IOS', mode: 'insensitive' } },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { active: true, expiresAt: { gte: expect.any(Date) } },
              { lastSeenAt: { gte: expect.any(Date) } },
            ]),
          }),
        ]),
      }),
    });
    expect(prisma.appSession.findMany).toBeUndefined();
  });

  it('builds dashboard app presence summary with aggregate queries instead of full user/session lists', async () => {
    const prisma = {
      appSession: {
        count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(4),
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([{ userId: 'customer-user-1' }, { userId: 'customer-user-2' }])
          .mockResolvedValueOnce([{ userId: 'provider-user-1' }]),
      },
      customerProfile: {
        count: vi.fn().mockResolvedValue(12),
      },
      booking: {
        count: vi.fn().mockResolvedValue(5),
      },
      providerEarning: {
        groupBy: vi.fn().mockResolvedValue([{ providerProfileId: 'provider-1' }]),
      },
      providerProfile: {
        count: vi
          .fn()
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(1),
        groupBy: vi.fn().mockResolvedValue([
          { status: ProviderStatus.ONLINE_AVAILABLE, _count: { _all: 2 } },
          { status: ProviderStatus.ONLINE_BUSY, _count: { _all: 1 } },
          { status: ProviderStatus.ONLINE_AVAILABLE_SOON, _count: { _all: 1 } },
          { status: ProviderStatus.OFFLINE, _count: { _all: 4 } },
        ]),
      },
      user: {
        count: vi.fn().mockResolvedValueOnce(9).mockResolvedValueOnce(2),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        {
          activeBookingCustomers: 2n,
          liveActiveBookingCustomers: 2n,
          liveOpenMatchingCustomers: 1n,
        },
      ]),
    };
    const service = createAdminService(prisma);

    await expect(service.dashboardSummary()).resolves.toMatchObject({
      appPresence: {
        activeBookingCustomers: 2,
        disabledPushCustomers: 2,
        liveActiveBookingCustomers: 2,
        liveAppCustomers: 2,
        liveAppPartners: 1,
        liveOpenMatchingCustomers: 1,
        reachableCustomers: 9,
        recentCustomerSessions: 3,
        staleCustomerSessions: 4,
        totalCustomers: 12,
      },
      partnerSupply: {
        approvedVerification: 4,
        bankApproved: 6,
        blocked: 1,
        cashDebtPartners: 0,
        firstRevenue: 1,
        kycApproved: 5,
        level2Active: 7,
        liveSessions: 1,
        noLocation: 1,
        offline: 4,
        online: 4,
        onlineAvailable: 2,
        onlineAvailableSoon: 1,
        onlineBusy: 1,
        pendingVerification: 3,
        staleLocation: 2,
        supplyPressureLabel: '2.5x',
        total: 8,
        withdrawalProfileReady: 1,
      },
    });

    expect(prisma.customerProfile.count).toHaveBeenCalledWith();
    expect(prisma.providerProfile.findMany).toBeUndefined();
    expect(prisma.providerProfile.count).toHaveBeenCalledTimes(10);
    expect(prisma.providerProfile.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    expect(prisma.providerEarning.groupBy).toHaveBeenCalledWith({
      by: ['providerProfileId'],
      where: { status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE, EarningStatus.PAID] } },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { status: { in: expect.any(Array) } },
    });
    expect(prisma.appSession.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['userId'],
        where: expect.objectContaining({ role: Role.CUSTOMER }),
      }),
    );
    expect(prisma.appSession.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['userId'],
        where: expect.objectContaining({ role: Role.PROVIDER }),
      }),
    );
    expect(prisma.appSession.count).toHaveBeenCalledTimes(2);
    expect(prisma.user.count).toHaveBeenCalledTimes(2);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps usage overview regional source rows bounded', async () => {
    const prisma = {
      appSession: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      booking: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      customerProviderProfileView: {
        groupBy: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getUsageOverview('7d')).resolves.toMatchObject({
      source: 'stored-usage-aggregates',
      range: '7d',
    });

    expect(prisma.appSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.booking.findMany.mock.calls.map(([query]) => query.take)).toEqual([100, 100]);
  });

  it('filters chat archive rows server-side and clamps requested limits', async () => {
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listChatArchive({
        dateRange: 'today',
        q: 'late',
        sender: 'partner',
        status: 'no-message',
        skip: '100',
        take: '999',
      }),
    ).resolves.toEqual([]);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { chatRoom: { isNot: null } },
            expect.objectContaining({
              OR: expect.arrayContaining([{ createdAt: expect.any(Object) }]),
            }),
            { chatRoom: { is: { messages: { none: {} } } } },
            {
              chatRoom: {
                is: {
                  messages: {
                    some: {
                      sender: { roles: { has: Role.PROVIDER } },
                    },
                  },
                },
              },
            },
            expect.objectContaining({
              OR: expect.arrayContaining([
                { id: { contains: 'late', mode: 'insensitive' } },
                {
                  chatRoom: {
                    is: {
                      messages: {
                        some: { body: { contains: 'late', mode: 'insensitive' } },
                      },
                    },
                  },
                },
              ]),
            }),
          ]),
        },
        orderBy: { updatedAt: 'desc' },
        select: expect.objectContaining({
          chatRoom: {
            select: expect.objectContaining({
              _count: { select: { messages: true } },
              messages: expect.objectContaining({ take: 25 }),
            }),
          },
        }),
        skip: 100,
        take: 50,
      }),
    );
  });

  it('counts chat archive summaries with the same server filters', async () => {
    const prisma = {
      booking: {
        count: vi
          .fn()
          .mockResolvedValueOnce(34)
          .mockResolvedValueOnce(11)
          .mockResolvedValueOnce(9)
          .mockResolvedValueOnce(4),
      },
      chatMessage: {
        count: vi
          .fn()
          .mockResolvedValueOnce(120)
          .mockResolvedValueOnce(70)
          .mockResolvedValueOnce(50),
        findFirst: vi.fn().mockResolvedValue({ createdAt: new Date('2026-06-27T03:00:00.000Z') }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.chatArchiveSummary({
        dateRange: 'today',
        q: 'late',
        sender: 'partner',
        status: 'no-message',
      }),
    ).resolves.toEqual({
      activeRooms: 9,
      completedRooms: 11,
      customerMessages: 70,
      emptyRooms: 4,
      generatedAt: expect.any(String),
      latestMessageAt: '2026-06-27T03:00:00.000Z',
      messageCount: 120,
      partnerMessages: 50,
      totalCount: 34,
    });

    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { chatRoom: { isNot: null } },
          { chatRoom: { is: { messages: { none: {} } } } },
        ]),
      }),
    });
    expect(prisma.chatMessage.count).toHaveBeenCalledWith({
      where: {
        chatRoom: {
          is: {
            booking: expect.objectContaining({
              AND: expect.arrayContaining([
                { chatRoom: { isNot: null } },
                { chatRoom: { is: { messages: { none: {} } } } },
              ]),
            }),
          },
        },
      },
    });
    expect(prisma.chatMessage.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
      where: {
        chatRoom: {
          is: {
            booking: expect.objectContaining({
              AND: expect.arrayContaining([
                { chatRoom: { isNot: null } },
                { chatRoom: { is: { messages: { none: {} } } } },
              ]),
            }),
          },
        },
      },
    });
    expect(prisma.booking.findMany).toBeUndefined();
  });

  it('filters audit logs by action and clamps requested limits', async () => {
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listAuditLogs({
        action: ' booking.create.rejected ',
        take: '250',
      }),
    ).resolves.toEqual([]);

    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: { action: 'booking.create.rejected' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: expect.objectContaining({
        action: true,
        actor: expect.any(Object),
        createdAt: true,
        metadata: true,
        target: true,
      }),
    });
  });

  it('filters audit logs by date, search, bucket, priority, and skip without loading the whole trail', async () => {
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listAuditLogs({
        bucket: 'Notification',
        from: '2026-06-27T00:00:00.000Z',
        priority: '4',
        q: 'booking-1',
        skip: '40',
        take: '20',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toEqual([]);

    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            createdAt: {
              gte: new Date('2026-06-27T00:00:00.000Z'),
              lt: new Date('2026-06-28T00:00:00.000Z'),
            },
          },
          {
            OR: [
              { action: { contains: 'booking-1', mode: 'insensitive' } },
              { target: { contains: 'booking-1', mode: 'insensitive' } },
              { actor: { fullName: { contains: 'booking-1', mode: 'insensitive' } } },
              { actor: { phone: { contains: 'booking-1', mode: 'insensitive' } } },
            ],
          },
          {
            OR: [{ action: { startsWith: 'notification.' } }, { action: { startsWith: 'push_device.' } }],
          },
          {
            OR: expect.arrayContaining([
              { action: { startsWith: 'operational_policy.' } },
              { action: { endsWith: '.retry' } },
            ]),
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: 40,
      take: 20,
      select: expect.objectContaining({
        action: true,
        actor: expect.any(Object),
        createdAt: true,
        metadata: true,
        target: true,
      }),
    });
  });

  it('counts audit log summaries with the same filters', async () => {
    const prisma = {
      adminAuditLog: {
        count: vi.fn().mockResolvedValue(120),
        groupBy: vi.fn().mockResolvedValue([
          { _count: { _all: 20 }, action: 'booking.completed' },
          { _count: { _all: 15 }, action: 'payment.capture' },
          { _count: { _all: 7 }, action: 'refund.retry' },
          { _count: { _all: 9 }, action: 'service.update' },
          { _count: { _all: 30 }, action: 'notification.retry' },
          { _count: { _all: 4 }, action: 'push_device.disable' },
          { _count: { _all: 2 }, action: 'operational_policy.update' },
        ]),
      },
    };
    prisma.adminAuditLog.count.mockResolvedValueOnce(120).mockResolvedValueOnce(3);
    const service = createAdminService(prisma);

    await expect(
      service.auditLogSummary({
        bucket: 'Notification',
        from: '2026-06-27T00:00:00.000Z',
        q: 'booking-1',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      dispatch: 20,
      financeCloseout: 22,
      generatedAt: expect.any(String),
      needsReview: 63,
      notifications: 34,
      payments: 22,
      recentHour: 3,
      servicePricing: 9,
      totalCount: 120,
    });

    expect(prisma.adminAuditLog.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          {
            createdAt: {
              gte: new Date('2026-06-27T00:00:00.000Z'),
              lt: new Date('2026-06-28T00:00:00.000Z'),
            },
          },
          {
            OR: [{ action: { startsWith: 'notification.' } }, { action: { startsWith: 'push_device.' } }],
          },
        ]),
      }),
    });
    expect(prisma.adminAuditLog.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ createdAt: { gte: expect.any(Date) } }]),
      }),
    });
    expect(prisma.adminAuditLog.groupBy).toHaveBeenCalledWith({
      by: ['action'],
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          {
            OR: [{ action: { startsWith: 'notification.' } }, { action: { startsWith: 'push_device.' } }],
          },
        ]),
      }),
      _count: { _all: true },
    });
  });

  it('keeps coupon list rows lightweight and moves booking usage to a paged endpoint', async () => {
    const coupon = {
      active: true,
      code: 'WELCOME10',
      description: 'Welcome campaign',
      discount: { type: 'percent', value: 10 },
      endsAt: null,
      id: 'coupon-1',
      startsAt: null,
    };
    const booking = {
      closedAt: null,
      createdAt: new Date('2026-06-12T09:00:00.000Z'),
      customerProfile: {
        user: {
          email: 'demo@example.com',
          fullName: 'Demo Customer',
          phone: '+84000000000',
        },
      },
      id: 'booking-1',
      payment: {
        amount: 270000,
        currency: 'VND',
        method: 'CASH',
        rawMeta: {
          couponCode: 'WELCOME10',
          couponId: 'coupon-1',
          discountAmount: 30000,
          originalAmount: 300000,
        },
        status: PaymentStatus.AUTHORIZED,
      },
      scheduledStartAt: new Date('2026-06-12T10:00:00.000Z'),
      selectedProvider: {
        displayName: 'Smoke Partner',
        user: {
          fullName: 'Partner User',
          phone: '+84111111111',
        },
      },
      services: [
        {
          price: 300000,
          service: {
            durationMin: 60,
            name: 'Massage',
          },
        },
      ],
      status: BookingStatus.OPEN_MATCHING,
    };
    const prisma = {
      booking: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([booking]),
      },
      coupon: {
        findMany: vi.fn().mockResolvedValue([coupon]),
        findUnique: vi.fn().mockResolvedValue(coupon),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listCoupons()).resolves.toEqual([
      expect.objectContaining({
        code: 'WELCOME10',
        usageBookings: [],
      }),
    ]);
    expect(prisma.coupon.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 10,
      }),
    );
    expect(prisma.booking.findMany).not.toHaveBeenCalled();

    await service.listCoupons({ take: '500' });
    expect(prisma.coupon.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );

    await expect(service.listCouponUsageBookings('coupon-1', { skip: '10', take: '10' })).resolves.toEqual({
      couponCode: 'WELCOME10',
      couponId: 'coupon-1',
      rows: [
        expect.objectContaining({
          amount: 270000,
          bookingId: 'booking-1',
          customerName: 'Demo Customer',
          discountAmount: 30000,
          partnerName: 'Smoke Partner',
          reversalStatus: 'ACTIVE',
          serviceName: 'Massage / 60 min',
        }),
      ],
      skip: 10,
      take: 10,
      totalCount: 1,
    });

    expect(prisma.booking.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payment: {
            is: {
              OR: [
                { rawMeta: { path: ['couponId'], equals: 'coupon-1' } },
                { rawMeta: { path: ['couponCode'], equals: 'WELCOME10' } },
              ],
            },
          },
        }),
      }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('marks refunded coupon usage bookings as reversed without hiding the audit row', async () => {
    const coupon = {
      active: true,
      code: 'WELCOME10',
      discount: { type: 'percent', value: 10 },
      id: 'coupon-1',
    };
    const prisma = {
      booking: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            closedAt: new Date('2026-06-13T09:00:00.000Z'),
            createdAt: new Date('2026-06-12T09:00:00.000Z'),
            customerProfile: {
              user: {
                email: 'demo@example.com',
                fullName: 'Demo Customer',
                phone: '+84000000000',
              },
            },
            id: 'booking-refunded-1',
            payment: {
              amount: 270000,
              currency: 'VND',
              method: 'MOMO',
              rawMeta: {
                couponCode: 'WELCOME10',
                couponId: 'coupon-1',
                discountAmount: 30000,
                originalAmount: 300000,
              },
              status: PaymentStatus.REFUNDED,
            },
            scheduledStartAt: new Date('2026-06-12T10:00:00.000Z'),
            selectedProvider: null,
            services: [],
            status: BookingStatus.REFUNDED,
          },
        ]),
      },
      coupon: {
        findUnique: vi.fn().mockResolvedValue(coupon),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listCouponUsageBookings('coupon-1')).resolves.toMatchObject({
      rows: [
        expect.objectContaining({
          bookingId: 'booking-refunded-1',
          paymentStatus: PaymentStatus.REFUNDED,
          reversalStatus: 'REVERSED',
          status: BookingStatus.REFUNDED,
        }),
      ],
      totalCount: 1,
    });
  });

  it('returns coupon status summary without hydrating booking usage rows', async () => {
    const prisma = {
      coupon: {
        count: vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(1),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.couponSummary()).resolves.toMatchObject({
      expiredCount: 3,
      liveCount: 4,
      pausedCount: 1,
      scheduledCount: 2,
      totalCount: 10,
    });

    expect(prisma.coupon.count).toHaveBeenCalledTimes(5);
  });

  it('deletes coupons and writes an audit entry', async () => {
    const coupon = {
      active: true,
      code: 'WELCOME10',
      description: null,
      discount: { type: 'percent', value: 10 },
      endsAt: null,
      id: 'coupon-1',
      startsAt: null,
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      coupon: {
        delete: vi.fn().mockResolvedValue(coupon),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.deleteCoupon('admin-1', 'coupon-1')).resolves.toEqual({
      couponId: 'coupon-1',
      ok: true,
    });

    expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 'coupon-1' } });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'coupon.delete',
        actorId: 'admin-1',
        metadata: { code: 'WELCOME10' },
        target: 'coupon:coupon-1',
      },
    });
  });

  it('adds server-computed matching evidence to booking list rows', async () => {
    const openedAt = new Date('2026-06-10T09:30:00.000Z');
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'booking-1',
            status: BookingStatus.OPEN_MATCHING,
            openedAt,
            createdAt: new Date('2026-06-10T09:00:00.000Z'),
            updatedAt: new Date('2026-06-10T09:45:00.000Z'),
            preferredProviderId: 'first-pick-partner',
            selectedProviderId: null,
            matchedAt: null,
            matchSource: null,
            chatRoom: null,
            addressSnapshot: {
              address: { formattedAddress: '12 Nguyen Hue, Da Nang' },
              addressText: null,
            },
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
        serviceAddressText: '12 Nguyen Hue, Da Nang',
        statusChangedAt: openedAt,
        statusChangedLabel: 'Matching opened at',
      }),
    ]);
  });

  it('adds server-computed matching evidence to booking detail rows', async () => {
    const matchedAt = new Date('2026-06-10T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.MATCHED,
          preferredProviderId: 'first-pick-partner',
          selectedProviderId: 'first-pick-partner',
          matchedAt,
          matchSource: BookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
          address: { address_text: '99 Tran Phu, Da Nang' },
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
        findMany: vi.fn().mockResolvedValue([]),
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
        serviceAddressText: '99 Tran Phu, Da Nang',
        statusChangedAt: matchedAt,
        statusChangedLabel: 'Matched at',
      }),
    );
  });

  it('keeps booking detail audit trail aligned with the activity export preview', async () => {
    const createdAt = new Date('2026-06-10T09:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CREATED,
          createdAt,
        }),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([{ id: 'audit-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getBookingDetail('booking-1')).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [{ id: 'audit-1' }],
      }),
    );

    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 40,
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { target: 'booking:booking-1' },
            { metadata: { path: ['bookingId'], equals: 'booking-1' } },
            { action: 'operational_policy.update', createdAt: { gte: createdAt } },
          ]),
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
        findMany: vi.fn().mockResolvedValue(
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
        findMany: vi.fn().mockResolvedValue([]),
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

  it('narrows admin booking list rows by route status group', async () => {
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listBookings({ statusGroup: 'realtime' });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: [
              BookingStatus.CREATED,
              BookingStatus.OPEN_MATCHING,
              BookingStatus.MATCHED,
              BookingStatus.PROVIDER_ON_THE_WAY,
              BookingStatus.ARRIVED,
              BookingStatus.IN_SERVICE,
            ],
          },
        },
      }),
    );
  });

  it('uses a bounded requested booking list limit', async () => {
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listBookings({ take: '25' });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
      }),
    );
  });

  it('clamps oversized admin booking list requests', async () => {
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listBookings({ take: '250' });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('includes persisted matching decision fields in booking detail queries', async () => {
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getBookingDetail('booking-1')).rejects.toThrow('Booking not found');

    expect(prisma.booking.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          matchedAt: true,
          matchSource: true,
          chatRoom: expect.objectContaining({
            select: expect.objectContaining({
              messages: expect.objectContaining({
                take: ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT,
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('returns disabled referral defaults when no admin policy exists yet', async () => {
    const prisma = {
      referralPolicy: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listReferralPolicies()).resolves.toMatchObject({
      customer: {
        audience: ReferralAudience.CUSTOMER,
        enabled: false,
        platformFeeVatRateBps: 800,
        rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        source: 'default-disabled',
      },
      partner: {
        audience: ReferralAudience.PARTNER,
        enabled: false,
        rewardMode: ReferralRewardMode.FIXED_AMOUNT,
        source: 'default-disabled',
      },
    });
    expect(prisma.referralPolicy.findMany).toHaveBeenCalledWith({
      orderBy: { audience: 'asc' },
    });
  });

  it('upserts referral policy settings and writes an audit trail', async () => {
    const updatedAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      referralPolicy: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          id: 'policy-customer',
          audience: ReferralAudience.CUSTOMER,
          enabled: true,
          rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
          commissionPercentBps: 600,
          fixedRewardAmount: null,
          perRewardCapAmount: null,
          totalRewardCapAmount: 500_000,
          maxRewardedReferrals: 8,
          maxRewardsPerReferred: 1,
          metadata: { platformFeeVatRateBps: 900 },
          holdPeriodDays: 7,
          currency: 'VND',
          notes: 'Customer referral launch',
          updatedAt,
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateReferralPolicy('admin-1', 'customer', {
        enabled: true,
        rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        commissionPercentBps: 600,
        totalRewardCapAmount: 500_000,
        maxRewardedReferrals: 8,
        maxRewardsPerReferred: 1,
        notes: ' Customer referral launch ',
        platformFeeVatRateBps: 900,
        reason: 'launch referral program',
      }),
    ).resolves.toMatchObject({
      audience: ReferralAudience.CUSTOMER,
      enabled: true,
      commissionPercentBps: 600,
      platformFeeVatRateBps: 900,
      totalRewardCapAmount: 500_000,
      source: 'stored-policy',
    });

    expect(prisma.referralPolicy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { audience: ReferralAudience.CUSTOMER },
        create: expect.objectContaining({
          createdById: 'admin-1',
          updatedById: 'admin-1',
          fixedRewardAmount: null,
          metadata: { platformFeeVatRateBps: 900 },
          rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        }),
        update: expect.objectContaining({
          updatedById: 'admin-1',
          commissionPercentBps: 600,
          metadata: { platformFeeVatRateBps: 900 },
        }),
      }),
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'referral_policy.update',
          actorId: 'admin-1',
          target: `referral_policy:${ReferralAudience.CUSTOMER}`,
        }),
      }),
    );
  });

  it('rejects mismatched referral reward modes for the audience', async () => {
    const prisma = {
      referralPolicy: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateReferralPolicy('admin-1', 'partner', {
        enabled: true,
        rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        commissionPercentBps: 500,
      }),
    ).rejects.toThrow('Partner referral policy must use fixed amount rewards');
    expect(prisma.referralPolicy.upsert).not.toHaveBeenCalled();
  });

  it('includes manual marketing spend in overview cost metrics', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          firstBookingCompleted: 1n,
          repeatBookingCompleted: 1n,
        },
      ]),
      appSession: {
        groupBy: vi.fn().mockResolvedValue([{ platform: 'ANDROID', _count: { _all: 2 } }]),
        count: vi.fn().mockResolvedValue(2),
      },
      user: {
        count: vi.fn().mockResolvedValue(2),
      },
      referralAttribution: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      customerSelectedLocation: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([]),
      },
      booking: {
        count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(2).mockResolvedValueOnce(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      payment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 1_200_000 } }),
      },
      providerPlatformFeeLog: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { platformFeeAmount: 300_000 } }),
      },
      refund: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      marketingSpendDaily: {
        findMany: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([
          {
            source: 'google',
            platform: 'android',
            regionCode: 'hcm',
            campaignId: 'launch-hcm',
            campaignName: 'Launch HCMC',
            _sum: { spendAmount: 600_000 },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    const overview = await service.getMarketingOverview({
      range: '7d',
      source: 'google',
      platform: 'android',
      regionCode: 'hcm',
      campaignId: 'launch-hcm',
    });

    expect(overview.totals).toMatchObject({
      adSpend: 600_000,
      firstOpens: 2,
      signups: 2,
      bookingCompleted: 2,
    });
    expect(overview.totals.conversionRates).toMatchObject({
      cpi: 300_000,
      cpa: 300_000,
      cpaBookingCompleted: 300_000,
      platformFeeRoas: 0.5,
      roas: 2,
    });
    expect(overview.bySource).toEqual([
      expect.objectContaining({
        source: 'google',
        platform: 'android',
        campaignId: 'launch-hcm',
        adSpend: 600_000,
      }),
    ]);
    expect(prisma.marketingSpendDaily.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['source', 'platform', 'regionCode', 'campaignId', 'campaignName'],
        _sum: { spendAmount: true },
        where: expect.objectContaining({
          source: 'google',
          platform: 'android',
          regionCode: 'hcm',
          campaignId: 'launch-hcm',
        }),
      }),
    );
    expect(prisma.marketingSpendDaily.findMany).not.toHaveBeenCalled();
    expect(prisma.customerSelectedLocation.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.booking.findMany.mock.calls.map(([query]) => query.take)).toEqual([100, 100, 100]);
  });

  it('keeps referral rewards out of marketing platform revenue', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          firstBookingCompleted: 1n,
          repeatBookingCompleted: 0n,
        },
      ]),
      appSession: {
        groupBy: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      user: {
        count: vi.fn().mockResolvedValue(1),
      },
      referralAttribution: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'attribution-1',
            installSource: 'referral',
            platform: 'ANDROID',
            createdAt: new Date('2026-06-20T00:00:00.000Z'),
            referralCode: {
              id: 'code-1',
              code: 'REFSMOKE',
            },
            rewards: [
              {
                id: 'reward-1',
                amount: 30_000,
                status: ReferralRewardStatus.AVAILABLE,
              },
            ],
          },
        ]),
      },
      customerSelectedLocation: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      booking: {
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      payment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 500_000 } }),
      },
      providerPlatformFeeLog: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { platformFeeAmount: 100_000 } }),
      },
      refund: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      marketingSpendDaily: {
        findMany: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    const overview = await service.getMarketingOverview({ range: '7d' });

    expect(overview.totals.platformFeeRevenue).toBe(100_000);
    expect(overview.bySource).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'unknown',
          platformFeeRevenue: 100_000,
        }),
        expect.objectContaining({
          source: 'referral',
          platformFeeRevenue: 0,
        }),
      ]),
    );
    expect(overview.byCampaign).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'referral',
          campaignId: 'REFSMOKE',
          platformFeeRevenue: 0,
        }),
      ]),
    );
  });

  it('returns marketing summary without loading dimension lists', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          firstBookingCompleted: 1n,
          repeatBookingCompleted: 0n,
        },
      ]),
      appSession: {
        count: vi.fn().mockResolvedValue(3),
      },
      user: {
        count: vi.fn().mockResolvedValue(2),
      },
      referralAttribution: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn(),
      },
      customerSelectedLocation: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn(),
      },
      booking: {
        count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(0),
        findMany: vi.fn(),
      },
      payment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 800_000 } }),
      },
      providerPlatformFeeLog: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { platformFeeAmount: 160_000 } }),
      },
      refund: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      marketingSpendDaily: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { spendAmount: 240_000 } }),
        findMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    const summary = await service.getMarketingSummary({
      range: '7d',
      source: 'google',
      platform: 'android',
      regionCode: 'hcm',
      campaignId: 'launch-hcm',
    });

    expect(summary.totals).toMatchObject({
      adSpend: 240_000,
      firstOpens: 3,
      signups: 2,
      bookingCompleted: 1,
    });
    expect(summary.funnel.map((step) => step.key)).toEqual([
      'app_first_open',
      'signup_completed',
      'address_saved',
      'booking_created',
      'booking_completed',
      'first_booking_completed',
      'repeat_booking_completed',
    ]);
    expect(summary.bySource).toBeUndefined();
    expect(prisma.marketingSpendDaily.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'google',
          platform: 'android',
          regionCode: 'hcm',
          campaignId: 'launch-hcm',
        }),
      }),
    );
    expect(prisma.marketingSpendDaily.findMany).not.toHaveBeenCalled();
    expect(prisma.customerSelectedLocation.findMany).not.toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.referralAttribution.findMany).not.toHaveBeenCalled();
  });

  it('returns paged marketing platform dimensions without loading unrelated dimension lists', async () => {
    const prisma = {
      appSession: {
        groupBy: vi.fn().mockResolvedValue([{ platform: 'ANDROID', _count: { _all: 3 } }]),
      },
      booking: {
        findMany: vi.fn(),
      },
      customerSelectedLocation: {
        findMany: vi.fn(),
      },
      referralAttribution: {
        findMany: vi.fn(),
      },
      marketingSpendDaily: {
        findMany: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([
          {
            source: 'google',
            platform: 'android',
            regionCode: 'hcm',
            campaignId: 'launch-hcm',
            campaignName: 'Launch HCMC',
            _sum: { spendAmount: 600_000 },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    const page = await service.listMarketingDimensionRows({
      dimension: 'platform',
      range: '7d',
      take: '1',
      skip: '0',
    });

    expect(page).toMatchObject({
      dimension: 'platform',
      skip: 0,
      take: 1,
      totalCount: 2,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toEqual(
      expect.objectContaining({
        platform: 'android',
      }),
    );
    expect(prisma.marketingSpendDaily.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['source', 'platform', 'regionCode', 'campaignId', 'campaignName'],
        _sum: { spendAmount: true },
      }),
    );
    expect(prisma.marketingSpendDaily.findMany).not.toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.customerSelectedLocation.findMany).not.toHaveBeenCalled();
    expect(prisma.referralAttribution.findMany).not.toHaveBeenCalled();
  });

  it('keeps referral reward amounts out of campaign dimension revenue', async () => {
    const prisma = {
      referralAttribution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'attribution-1',
            installSource: 'referral',
            platform: 'ANDROID',
            createdAt: new Date('2026-06-20T00:00:00.000Z'),
            referralCode: {
              id: 'code-1',
              code: 'REFSMOKE',
            },
            rewards: [
              {
                id: 'reward-1',
                amount: 30_000,
                status: ReferralRewardStatus.AVAILABLE,
              },
            ],
          },
        ]),
      },
      marketingSpendDaily: {
        findMany: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    const page = await service.listMarketingDimensionRows({
      dimension: 'campaign',
      range: '7d',
      take: '10',
      skip: '0',
    });

    expect(page.rows).toEqual([
      expect.objectContaining({
        source: 'referral',
        campaignId: 'REFSMOKE',
        firstBookingCompleted: 1,
        platformFeeRevenue: 0,
      }),
    ]);
  });

  it('upserts manual marketing spend and writes an audit trail', async () => {
    const spendDate = new Date('2026-06-20T00:00:00.000Z');
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      marketingSpendDaily: {
        upsert: vi.fn().mockResolvedValue({
          id: 'spend-1',
          spendDate,
          source: 'google',
          platform: 'android',
          regionCode: 'hcm',
          campaignId: 'launch-hcm',
          campaignName: 'Launch HCMC',
          spendAmount: 600_000,
          currency: 'VND',
          notes: 'manual import',
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.upsertMarketingSpendDaily('admin-1', {
        spendDate: '2026-06-20',
        source: 'Google Ads',
        platform: 'ANDROID',
        regionCode: 'hcm',
        campaignId: ' launch-hcm ',
        campaignName: ' Launch HCMC ',
        spendAmount: 600_000,
        notes: ' manual import ',
      }),
    ).resolves.toMatchObject({
      source: 'google',
      platform: 'android',
      campaignId: 'launch-hcm',
      spendAmount: 600_000,
    });

    expect(prisma.marketingSpendDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          spendDate_source_platform_regionCode_campaignId: {
            spendDate,
            source: 'google',
            platform: 'android',
            regionCode: 'hcm',
            campaignId: 'launch-hcm',
          },
        },
        create: expect.objectContaining({
          createdById: 'admin-1',
          spendAmount: 600_000,
        }),
        update: expect.objectContaining({
          updatedById: 'admin-1',
          spendAmount: 600_000,
        }),
      }),
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'marketing_spend_daily.upsert',
          actorId: 'admin-1',
          target: 'marketing_spend_daily:google:android:hcm:launch-hcm:2026-06-20',
        }),
      }),
    );
  });

  it('releases available referral rewards without creating wallet ledger entries', async () => {
    const referrals = {
      releaseAvailableRewards: vi.fn().mockResolvedValue({ releasedCount: 3 }),
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(service.releaseAvailableReferralRewards('admin-1')).resolves.toEqual({
      releasedCount: 3,
    });

    expect(referrals.releaseAvailableRewards).toHaveBeenCalledWith();
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'referral_reward.release_available',
        target: 'referral_rewards:available',
        metadata: {
          releasedCount: 3,
          walletCreditCreated: false,
        },
      },
    });
  });

  it('holds a referral reward candidate without creating wallet ledger entries', async () => {
    const referrals = {
      holdRewardCandidate: vi.fn().mockResolvedValue({
        id: 'reward-1',
        amount: 25000,
        currency: 'VND',
        status: ReferralRewardStatus.HELD,
      }),
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.holdReferralReward('admin-1', 'reward-1', {
        reason: ' suspicious signup pattern ',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: ReferralRewardStatus.HELD,
    });

    expect(referrals.holdRewardCandidate).toHaveBeenCalledWith('reward-1');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'referral_reward.hold',
        target: 'referral_reward:reward-1',
        metadata: {
          amount: 25000,
          currency: 'VND',
          reason: 'suspicious signup pattern',
          status: ReferralRewardStatus.HELD,
          walletCreditCreated: false,
        },
      },
    });
  });

  it('reverses a referral reward candidate without creating wallet ledger entries', async () => {
    const referrals = {
      reverseRewardCandidate: vi.fn().mockResolvedValue({
        id: 'reward-1',
        amount: 25000,
        currency: 'VND',
        status: ReferralRewardStatus.REVERSED,
      }),
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.reverseReferralReward('admin-1', 'reward-1', {
        reason: ' invalid referral attribution ',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: ReferralRewardStatus.REVERSED,
    });

    expect(referrals.reverseRewardCandidate).toHaveBeenCalledWith('reward-1');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'referral_reward.reverse',
        target: 'referral_reward:reward-1',
        metadata: {
          amount: 25000,
          currency: 'VND',
          reason: 'invalid referral attribution',
          status: ReferralRewardStatus.REVERSED,
          walletCreditCreated: false,
        },
      },
    });
  });

  it('credits an available referral reward candidate to its wallet ledger', async () => {
    const referrals = {
      creditRewardCandidate: vi.fn().mockResolvedValue({
        id: 'reward-1',
        amount: 25000,
        currency: 'VND',
        status: ReferralRewardStatus.REWARDED,
        walletLedgerReference: 'customer-wallet-ledger-1',
      }),
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.creditReferralReward('admin-1', 'reward-1', {
        reason: ' manual payout check ',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: ReferralRewardStatus.REWARDED,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(referrals.creditRewardCandidate).toHaveBeenCalledWith('reward-1');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'referral_reward.credit',
        target: 'referral_reward:reward-1',
        metadata: {
          amount: 25000,
          currency: 'VND',
          reason: 'manual payout check',
          status: ReferralRewardStatus.REWARDED,
          walletCreditCreated: true,
          walletLedgerReference: 'customer-wallet-ledger-1',
        },
      },
    });
  });

  it('approves referral reward cashout requests without posting payout cash automatically', async () => {
    const referrals = {
      approveRewardCashoutRequest: vi.fn().mockResolvedValue({
        id: 'reward-1',
        amount: 25000,
        currency: 'VND',
        status: cashoutApprovedReferralRewardStatus,
        walletLedgerReference: 'customer-wallet-ledger-1',
      }),
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.approveReferralRewardCashout('admin-1', 'reward-1', {
        reason: ' manual bank transfer done ',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: cashoutApprovedReferralRewardStatus,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(referrals.approveRewardCashoutRequest).toHaveBeenCalledWith('reward-1');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'referral_reward.cashout_approve',
        target: 'referral_reward:reward-1',
        metadata: {
          amount: 25000,
          cashoutApproved: true,
          currency: 'VND',
          reason: 'manual bank transfer done',
          status: cashoutApprovedReferralRewardStatus,
          walletCreditCreated: false,
          walletLedgerReference: 'customer-wallet-ledger-1',
        },
      },
    });
  });

  it('marks referral reward cashout requests for tax review without changing wallet credit references', async () => {
    const referrals = {
      requireRewardTaxReview: vi.fn().mockResolvedValue({
        id: 'reward-1',
        amount: 25000,
        currency: 'VND',
        status: taxReviewRequiredReferralRewardStatus,
        walletLedgerReference: 'customer-wallet-ledger-1',
      }),
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.requireReferralRewardTaxReview('admin-1', 'reward-1', {
        reason: ' tax document mismatch ',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: taxReviewRequiredReferralRewardStatus,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(referrals.requireRewardTaxReview).toHaveBeenCalledWith('reward-1');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'referral_reward.tax_review_required',
        target: 'referral_reward:reward-1',
        metadata: {
          amount: 25000,
          currency: 'VND',
          reason: 'tax document mismatch',
          status: taxReviewRequiredReferralRewardStatus,
          taxReviewRequired: true,
          walletCreditCreated: false,
          walletLedgerReference: 'customer-wallet-ledger-1',
        },
      },
    });
  });

  it('marks approved referral reward cashouts as paid with transfer evidence', async () => {
    const referrals = {
      payRewardCashout: vi.fn().mockResolvedValue({
        id: 'reward-1',
        amount: 25000,
        currency: 'VND',
        status: paidReferralRewardStatus,
        walletLedgerReference: 'customer-cashout-ledger-1',
      }),
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.markReferralRewardCashoutPaid('admin-1', 'reward-1', {
        reason: ' customer cashout transfer completed ',
        transferRef: ' VCB-REF-001 ',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: paidReferralRewardStatus,
      walletLedgerReference: 'customer-cashout-ledger-1',
    });

    expect(referrals.payRewardCashout).toHaveBeenCalledWith('reward-1', {
      notes: 'customer cashout transfer completed',
      reference: 'VCB-REF-001',
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'referral_reward.cashout_paid',
        target: 'referral_reward:reward-1',
        metadata: {
          amount: 25000,
          cashoutPaid: true,
          currency: 'VND',
          reason: 'customer cashout transfer completed',
          status: paidReferralRewardStatus,
          transferRef: 'VCB-REF-001',
          walletCreditCreated: false,
          walletLedgerReference: 'customer-cashout-ledger-1',
        },
      },
    });
  });

  it('creates referral reward candidates after completed booking closeout', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          notes: null,
          selectedProviderId: 'partner-1',
          payment: { id: 'payment-1', status: PaymentStatus.CAPTURED },
        }),
        update: vi.fn().mockResolvedValue({ id: 'booking-1' }),
      },
    };
    const earnings = {
      createForCompletedBooking: vi.fn().mockResolvedValue({
        id: 'earning-1',
        netAmount: 700_000,
      }),
    };
    const referrals = {
      createRewardsForCompletedBooking: vi.fn().mockResolvedValue({
        customerReward: { id: 'customer-reward-1' },
        partnerReward: null,
      }),
    };
    const service = createAdminService(prisma, { earnings, referrals });

    await expect(
      service.closeoutCompletedBooking('admin-1', 'booking-1', {
        note: 'Closeout checked',
      }),
    ).resolves.toEqual({ id: 'booking-1' });

    expect(referrals.createRewardsForCompletedBooking).toHaveBeenCalledWith('booking-1');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'booking.completed.closeout',
        metadata: expect.objectContaining({
          referralRewards: {
            customerRewardId: 'customer-reward-1',
            partnerRewardId: null,
          },
        }),
      }),
    });
  });

  it('lists only customer referral parents and summarizes reward exposure', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const decisionAt = new Date('2026-06-24T11:00:00.000Z');
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'parent-customer',
            user: { id: 'user-parent', phone: '+84000000001', fullName: 'Parent Customer' },
            referralCodes: [{ id: 'code-1', code: 'HANDSCUST', active: true, createdAt }],
            referralsMade: [
              {
                id: 'attribution-1',
                status: 'QUALIFIED',
                fraudReviewStatus: 'CLEAR',
                installSource: 'referral-link',
                platform: 'android',
                createdAt,
                referredCustomerProfile: {
                  id: 'referred-customer',
                  user: { id: 'user-referred', phone: '+84000000002', fullName: 'Referred Customer' },
                },
                rewards: [
                  {
                    id: 'reward-available',
                    amount: 25_000,
                    calculationSnapshot: {
                      platformFeeNetRevenue: 118_519,
                      rewardRateSnapshotBps: 3_000,
                      taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY',
                    },
                    currency: 'VND',
                    status: ReferralRewardStatus.AVAILABLE,
                    qualifyingBookingId: 'booking-1',
                    walletLedgerReference: null,
                    availableAt: createdAt,
                    createdAt,
                  },
                  {
                    id: 'reward-pending',
                    amount: 10_000,
                    currency: 'VND',
                    status: ReferralRewardStatus.PENDING,
                    qualifyingBookingId: 'booking-2',
                    walletLedgerReference: null,
                    availableAt: null,
                    createdAt,
                  },
                  {
                    id: 'reward-rewarded',
                    amount: 15_000,
                    calculationSnapshot: {
                      platformFeeNetRevenue: 118_519,
                      rewardRateSnapshotBps: 3_000,
                      taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY',
                    },
                    currency: 'VND',
                    status: ReferralRewardStatus.REWARDED,
                    qualifyingBookingId: 'booking-3',
                    walletLedgerReference: 'customer-wallet-ledger-1',
                    availableAt: createdAt,
                    createdAt,
                  },
                ],
              },
            ],
          },
        ]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'audit-1',
            action: 'referral_reward.credit',
            target: 'referral_reward:reward-rewarded',
            metadata: {
              reason: 'manual payout check',
              status: ReferralRewardStatus.REWARDED,
              walletLedgerReference: 'customer-wallet-ledger-1',
            },
            createdAt: decisionAt,
            actor: { id: 'admin-1', phone: '+84000009999', fullName: 'Ops Admin' },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listCustomerReferralParents({
        q: 'Parent',
        reward: 'available',
        skip: '50',
        status: 'qualified',
        take: '25',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        referrer: expect.objectContaining({ id: 'parent-customer' }),
        referralCode: expect.objectContaining({ code: 'HANDSCUST' }),
        referrals: [
          expect.objectContaining({
            referredCustomer: expect.objectContaining({ id: 'referred-customer' }),
            rewards: expect.arrayContaining([
              expect.objectContaining({
                calculationSnapshot: expect.objectContaining({
                  platformFeeNetRevenue: 118_519,
                  rewardRateSnapshotBps: 3_000,
                  taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY',
                }),
                id: 'reward-rewarded',
                latestDecision: {
                  action: 'referral_reward.credit',
                  actor: { id: 'admin-1', phone: '+84000009999', fullName: 'Ops Admin' },
                  createdAt: decisionAt,
                  reason: 'manual payout check',
                  status: ReferralRewardStatus.REWARDED,
                  walletLedgerReference: 'customer-wallet-ledger-1',
                },
              }),
            ]),
          }),
        ],
        totals: expect.objectContaining({
          availableRewardAmount: 25_000,
          pendingRewardAmount: 10_000,
          rewardedRewardAmount: 15_000,
          rewardedRewardCount: 1,
          referralCount: 1,
          rewardCount: 3,
          totalRewardAmount: 50_000,
        }),
      }),
    ]);
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        select: expect.objectContaining({
          referralsMade: expect.objectContaining({
            select: expect.objectContaining({
              rewards: expect.objectContaining({
                select: expect.objectContaining({
                  calculationSnapshot: true,
                }),
              }),
            }),
          }),
        }),
        take: 25,
        where: {
          AND: expect.arrayContaining([
            { referralsMade: { some: { audience: ReferralAudience.CUSTOMER } } },
            {
              OR: expect.arrayContaining([
                { id: { contains: 'Parent', mode: 'insensitive' } },
                { user: { fullName: { contains: 'Parent', mode: 'insensitive' } } },
                { referralCodes: { some: { audience: ReferralAudience.CUSTOMER, code: { contains: 'Parent', mode: 'insensitive' } } } },
              ]),
            },
            {
              referralsMade: {
                some: {
                  audience: ReferralAudience.CUSTOMER,
                  status: { in: [ReferralAttributionStatus.QUALIFIED, ReferralAttributionStatus.REWARDED] },
                },
              },
            },
            {
              referralsMade: {
                some: {
                  audience: ReferralAudience.CUSTOMER,
                  rewards: { some: { status: { in: [ReferralRewardStatus.AVAILABLE] } } },
                },
              },
            },
          ]),
        },
      }),
    );
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: expect.objectContaining({
        action: true,
        actor: expect.any(Object),
        createdAt: true,
        metadata: true,
        target: true,
      }),
      where: {
        action: {
          in: [
            'referral_reward.hold',
            'referral_reward.credit',
            'referral_reward.reverse',
            'referral_reward.cashout_approve',
            'referral_reward.tax_review_required',
            'referral_reward.cashout_paid',
          ],
        },
        target: {
          in: [
            'referral_reward:reward-available',
            'referral_reward:reward-pending',
            'referral_reward:reward-rewarded',
          ],
        },
      },
    });
  });

  it('treats legacy rewarded and credited referral rewards as credited in parent filters', async () => {
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listCustomerReferralParents({ reward: 'credited' })).resolves.toEqual([]);
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { referralsMade: { some: { audience: ReferralAudience.CUSTOMER } } },
            {
              referralsMade: {
                some: {
                  audience: ReferralAudience.CUSTOMER,
                  rewards: {
                    some: {
                      status: {
                        in: [ReferralRewardStatus.REWARDED, creditedReferralRewardStatus],
                      },
                    },
                  },
                },
              },
            },
          ]),
        },
      }),
    );
  });

  it('loads one customer referral parent detail only when referral activity exists', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'parent-customer',
          user: { id: 'user-parent', phone: '+84000000001', fullName: 'Parent Customer' },
          referralCodes: [{ id: 'code-1', code: 'HANDSCUST', active: true, createdAt }],
          referralsMade: [
            {
              id: 'attribution-1',
              status: 'REGISTERED',
              fraudReviewStatus: 'CLEAR',
              installSource: 'referral-link',
              platform: 'ios',
              createdAt,
              referredCustomerProfile: {
                id: 'referred-customer',
                user: { id: 'user-referred', phone: '+84000000002', fullName: 'Referred Customer' },
              },
              rewards: [],
            },
          ],
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getCustomerReferralParent('parent-customer')).resolves.toEqual(
      expect.objectContaining({
        referrer: expect.objectContaining({ id: 'parent-customer' }),
        referrals: [expect.objectContaining({ id: 'attribution-1' })],
      }),
    );
    expect(prisma.customerProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'parent-customer',
          referralsMade: { some: { audience: ReferralAudience.CUSTOMER } },
        },
      }),
    );
  });

  it('paginates partner referral parent accounts before reward decision lookup', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerReferralParents({
        q: 'Parent',
        reward: 'held',
        skip: '20',
        status: 'blocked',
        take: '10',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
        where: {
          AND: expect.arrayContaining([
            { referralsMade: { some: { audience: ReferralAudience.PARTNER } } },
            {
              OR: expect.arrayContaining([
                { id: { contains: 'Parent', mode: 'insensitive' } },
                { displayName: { contains: 'Parent', mode: 'insensitive' } },
                { user: { fullName: { contains: 'Parent', mode: 'insensitive' } } },
              ]),
            },
            {
              referralsMade: {
                some: {
                  audience: ReferralAudience.PARTNER,
                  status: { in: [ReferralAttributionStatus.BLOCKED, ReferralAttributionStatus.CANCELLED] },
                },
              },
            },
            {
              referralsMade: {
                some: {
                  audience: ReferralAudience.PARTNER,
                  rewards: { some: { status: { in: [ReferralRewardStatus.HELD] } } },
                },
              },
            },
          ]),
        },
      }),
    );
    expect(prisma.adminAuditLog.findMany).not.toHaveBeenCalled();
  });

  it('bounds referral parent list defaults before hydrating nested referral rewards', async () => {
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listCustomerReferralParents();
    expect(prisma.customerProfile.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 10,
      }),
    );

    await service.listPartnerReferralParents({ take: '500' });
    expect(prisma.providerProfile.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('summarizes customer referral parent counts and reward queues without loading parent rows', async () => {
    const prisma = {
      customerProfile: {
        count: vi.fn().mockResolvedValue(12),
      },
      referralReward: {
        groupBy: vi.fn().mockResolvedValue([
          {
            status: ReferralRewardStatus.AVAILABLE,
            _count: { _all: 3 },
            _sum: { amount: 75_000 },
          },
          {
            status: ReferralRewardStatus.REWARDED,
            _count: { _all: 2 },
            _sum: { amount: 50_000 },
          },
          {
            status: creditedReferralRewardStatus,
            _count: { _all: 1 },
            _sum: { amount: 35_000 },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.customerReferralParentSummary()).resolves.toEqual({
      totalCount: 12,
      rewardQueueSummaries: [
        { reward: 'all', count: 6, amount: 160_000 },
        { reward: 'available', count: 3, amount: 75_000 },
        { reward: 'pending', count: 0, amount: 0 },
        { reward: 'held', count: 0, amount: 0 },
        { reward: 'credited', count: 3, amount: 85_000 },
      ],
    });
    expect(prisma.customerProfile.count).toHaveBeenCalledWith({
      where: {
        AND: [{ referralsMade: { some: { audience: ReferralAudience.CUSTOMER } } }],
      },
    });
    expect(prisma.referralReward.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { attribution: { AND: [{ audience: ReferralAudience.CUSTOMER }] } },
      _count: { _all: true },
      _sum: { amount: true },
    });
  });

  it('summarizes partner referral parent counts and reward queues without loading parent rows', async () => {
    const prisma = {
      providerProfile: {
        count: vi.fn().mockResolvedValue(7),
      },
      referralReward: {
        groupBy: vi.fn().mockResolvedValue([
          {
            status: ReferralRewardStatus.PENDING,
            _count: { _all: 4 },
            _sum: { amount: 400_000 },
          },
          {
            status: ReferralRewardStatus.HELD,
            _count: { _all: 1 },
            _sum: { amount: 100_000 },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.partnerReferralParentSummary()).resolves.toEqual({
      totalCount: 7,
      rewardQueueSummaries: [
        { reward: 'all', count: 5, amount: 500_000 },
        { reward: 'available', count: 0, amount: 0 },
        { reward: 'pending', count: 4, amount: 400_000 },
        { reward: 'held', count: 1, amount: 100_000 },
        { reward: 'credited', count: 0, amount: 0 },
      ],
    });
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: {
        AND: [{ referralsMade: { some: { audience: ReferralAudience.PARTNER } } }],
      },
    });
    expect(prisma.referralReward.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { attribution: { AND: [{ audience: ReferralAudience.PARTNER }] } },
      _count: { _all: true },
      _sum: { amount: true },
    });
  });

  it('lists referral cashout rewards without hydrating full referral parent records', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const decisionAt = new Date('2026-06-24T11:00:00.000Z');
    const prisma = {
      referralReward: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'reward-1',
            amount: 25_000,
            calculationSnapshot: { taxPolicySnapshot: 'CUSTOMER_CASHOUT_REVIEW' },
            currency: 'VND',
            status: cashoutApprovedReferralRewardStatus,
            qualifyingBookingId: 'booking-1',
            walletLedgerReference: 'customer-wallet-credit-1',
            availableAt: createdAt,
            createdAt,
            attribution: {
              id: 'attribution-1',
              audience: ReferralAudience.CUSTOMER,
              status: ReferralAttributionStatus.QUALIFIED,
              fraudReviewStatus: 'CLEAR',
              installSource: 'referral-link',
              platform: 'ios',
              createdAt,
              referrerCustomerProfile: {
                id: 'parent-customer',
                user: { id: 'user-parent', phone: '+84000000001', fullName: 'Parent Customer' },
              },
              referrerProviderProfile: null,
              referredCustomerProfile: {
                id: 'referred-customer',
                user: { id: 'user-referred', phone: '+84000000002', fullName: 'Referred Customer' },
              },
              referredProviderProfile: null,
            },
          },
        ]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'audit-1',
            action: 'referral_reward.cashout_approve',
            target: 'referral_reward:reward-1',
            metadata: {
              reason: 'approved for manual bank transfer',
              status: cashoutApprovedReferralRewardStatus,
              walletLedgerReference: 'customer-wallet-credit-1',
            },
            createdAt: decisionAt,
            actor: { id: 'admin-1', phone: '+84000009999', fullName: 'Ops Admin' },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listReferralCashoutQueue({
        audience: 'customer',
        q: 'Parent',
        skip: '20',
        status: 'approved',
        take: '10',
      }),
    ).resolves.toEqual([
      {
        id: 'reward-1',
        amount: 25_000,
        attribution: expect.objectContaining({
          audience: ReferralAudience.CUSTOMER,
          id: 'attribution-1',
          platform: 'ios',
          status: ReferralAttributionStatus.QUALIFIED,
        }),
        audience: ReferralAudience.CUSTOMER,
        availableAt: createdAt,
        calculationSnapshot: { taxPolicySnapshot: 'CUSTOMER_CASHOUT_REVIEW' },
        createdAt,
        currency: 'VND',
        detailHref: '/referrals/customers/parent-customer',
        latestDecision: {
          action: 'referral_reward.cashout_approve',
          actor: { id: 'admin-1', phone: '+84000009999', fullName: 'Ops Admin' },
          createdAt: decisionAt,
          reason: 'approved for manual bank transfer',
          status: cashoutApprovedReferralRewardStatus,
          walletLedgerReference: 'customer-wallet-credit-1',
        },
        parent: {
          href: '/customers/parent-customer',
          id: 'parent-customer',
          label: 'Parent Customer',
          phone: '+84000000001',
        },
        payoutProfile: {
          account: null,
          helper: 'Customer referral rewards credit to the customer wallet; bank cashout details are not collected in MVP.',
          label: 'Customer wallet reward',
          status: 'WALLET_ONLY',
          type: 'CUSTOMER_WALLET',
        },
        qualifyingBookingId: 'booking-1',
        referred: {
          href: '/customers/referred-customer',
          id: 'referred-customer',
          label: 'Referred Customer',
          phone: '+84000000002',
        },
        status: cashoutApprovedReferralRewardStatus,
        walletLedgerReference: 'customer-wallet-credit-1',
      },
    ]);
    expect(prisma.referralReward.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: expect.objectContaining({
        attribution: expect.objectContaining({
          select: expect.objectContaining({
            referrerCustomerProfile: expect.any(Object),
            referredCustomerProfile: expect.any(Object),
          }),
        }),
      }),
      skip: 20,
      take: 10,
      where: {
        AND: expect.arrayContaining([
          { status: { in: [cashoutApprovedReferralRewardStatus] } },
          { attribution: { audience: ReferralAudience.CUSTOMER } },
          {
            OR: expect.arrayContaining([
              { id: { contains: 'Parent', mode: 'insensitive' } },
              {
                attribution: {
                  referrerCustomerProfile: {
                    is: { user: { fullName: { contains: 'Parent', mode: 'insensitive' } } },
                  },
                },
              },
            ]),
          },
        ]),
      },
    });
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: expect.objectContaining({
        action: true,
        actor: expect.any(Object),
        createdAt: true,
        metadata: true,
        target: true,
      }),
      where: {
        action: { in: expect.arrayContaining(['referral_reward.cashout_paid']) },
        target: { in: ['referral_reward:reward-1'] },
      },
    });
  });

  it('summarizes referral cashout queue statuses without loading reward rows', async () => {
    const prisma = {
      referralReward: {
        count: vi.fn().mockResolvedValue(6),
        groupBy: vi.fn().mockResolvedValue([
          { status: ReferralRewardStatus.CASHOUT_REQUESTED, _count: { _all: 2 }, _sum: { amount: 50_000 } },
          { status: cashoutApprovedReferralRewardStatus, _count: { _all: 1 }, _sum: { amount: 25_000 } },
          { status: taxReviewRequiredReferralRewardStatus, _count: { _all: 1 }, _sum: { amount: 30_000 } },
          { status: paidReferralRewardStatus, _count: { _all: 2 }, _sum: { amount: 80_000 } },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.referralCashoutQueueSummary({
        audience: 'partner',
        q: 'smoke',
        status: 'all',
      }),
    ).resolves.toEqual({
      totalAmount: 185_000,
      totalCount: 6,
      statusSummaries: [
        { amount: 50_000, count: 2, status: 'requested' },
        { amount: 25_000, count: 1, status: 'approved' },
        { amount: 30_000, count: 1, status: 'tax-review' },
        { amount: 80_000, count: 2, status: 'paid' },
      ],
    });
    expect(prisma.referralReward.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ attribution: { audience: ReferralAudience.PARTNER } }]),
      }),
    });
    expect(prisma.referralReward.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ attribution: { audience: ReferralAudience.PARTNER } }]),
      }),
      _count: { _all: true },
      _sum: { amount: true },
    });
  });

  it('surfaces partner payout bank correction status in referral cashout rows', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const reviewedAt = new Date('2026-06-24T12:00:00.000Z');
    const prisma = {
      referralReward: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'reward-partner-bank',
            amount: 150_000,
            calculationSnapshot: { rewardMode: 'FIXED_AMOUNT' },
            currency: 'VND',
            status: ReferralRewardStatus.CASHOUT_REQUESTED,
            qualifyingBookingId: 'booking-partner-1',
            walletLedgerReference: null,
            availableAt: createdAt,
            createdAt,
            attribution: {
              id: 'attribution-partner-1',
              audience: ReferralAudience.PARTNER,
              status: ReferralAttributionStatus.QUALIFIED,
              fraudReviewStatus: 'CLEAR',
              installSource: 'referral-link',
              platform: 'android',
              createdAt,
              referrerCustomerProfile: null,
              referrerProviderProfile: {
                id: 'parent-partner',
                displayName: 'Parent Partner',
                level: 2,
                status: ProviderStatus.ONLINE_AVAILABLE,
                user: { id: 'user-parent-partner', phone: '+84000000003', fullName: 'Parent Partner' },
                bankAccounts: [
                  {
                    id: 'bank-1',
                    accountHolderName: 'Parent Partner',
                    accountNumberLast4: '1234',
                    accountNumberMasked: '****1234',
                    bankName: 'VCB',
                    isPrimary: true,
                    rejectionReason: 'Account holder name does not match KYC.',
                    reviewedAt,
                    status: ProviderBankAccountStatus.REJECTED,
                    updatedAt: reviewedAt,
                  },
                ],
              },
              referredCustomerProfile: null,
              referredProviderProfile: {
                id: 'referred-partner',
                displayName: 'Referred Partner',
                level: 2,
                status: ProviderStatus.ONLINE_AVAILABLE,
                user: { id: 'user-referred-partner', phone: '+84000000004', fullName: 'Referred Partner' },
              },
            },
          },
        ]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listReferralCashoutQueue({ audience: 'partner' })).resolves.toEqual([
      expect.objectContaining({
        id: 'reward-partner-bank',
        audience: ReferralAudience.PARTNER,
        parent: expect.objectContaining({
          href: '/partners/parent-partner',
          label: 'Parent Partner',
        }),
        payoutProfile: {
          account: {
            accountHolderName: 'Parent Partner',
            accountNumberLast4: '1234',
            accountNumberMasked: '****1234',
            bankName: 'VCB',
            id: 'bank-1',
            isPrimary: true,
            rejectionReason: 'Account holder name does not match KYC.',
            reviewedAt,
            status: ProviderBankAccountStatus.REJECTED,
            updatedAt: reviewedAt,
          },
          helper: 'Account holder name does not match KYC.',
          label: 'Bank correction required',
          status: 'CORRECTION_REQUIRED',
          type: 'PROVIDER_BANK_ACCOUNT',
        },
      }),
    ]);
    expect(prisma.referralReward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          attribution: expect.objectContaining({
            select: expect.objectContaining({
              referrerProviderProfile: expect.objectContaining({
                select: expect.objectContaining({
                  bankAccounts: expect.objectContaining({
                    take: 3,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('rejects customer referral parent detail when the customer has no referral activity', async () => {
    const prisma = {
      customerProfile: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getCustomerReferralParent('customer-without-referrals')).rejects.toThrow(
      'Customer referral parent was not found',
    );
  });

  it('loads one partner referral parent detail only when referral activity exists', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      providerProfile: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'parent-partner',
          displayName: 'Parent Partner',
          level: 2,
          status: ProviderStatus.ONLINE_AVAILABLE,
          user: { id: 'user-parent', phone: '+84000000003', fullName: 'Parent Partner' },
          referralCodes: [{ id: 'code-1', code: 'HANDSPARTNER', active: true, createdAt }],
          referralsMade: [
            {
              id: 'attribution-1',
              status: 'QUALIFIED',
              fraudReviewStatus: 'CLEAR',
              installSource: 'referral-link',
              platform: 'android',
              createdAt,
              referredProviderProfile: {
                id: 'referred-partner',
                displayName: 'Referred Partner',
                level: 2,
                status: ProviderStatus.ONLINE_AVAILABLE,
                user: { id: 'user-referred', phone: '+84000000004', fullName: 'Referred Partner' },
              },
              rewards: [
                {
                  id: 'reward-available',
                  amount: 100_000,
                  currency: 'VND',
                  status: ReferralRewardStatus.AVAILABLE,
                  qualifyingBookingId: 'booking-1',
                  walletLedgerReference: null,
                  availableAt: createdAt,
                  createdAt,
                },
              ],
            },
          ],
        }),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getPartnerReferralParent('parent-partner')).resolves.toEqual(
      expect.objectContaining({
        referrer: expect.objectContaining({ id: 'parent-partner' }),
        totals: expect.objectContaining({ availableRewardAmount: 100_000 }),
      }),
    );
    expect(prisma.providerProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'parent-partner',
          referralsMade: { some: { audience: ReferralAudience.PARTNER } },
        },
      }),
    );
  });

  it('lists booking notification evidence by booking id without loading the global notification board', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listBookingNotifications('booking-1', { take: '12' });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 12,
        where: { data: { path: ['bookingId'], equals: 'booking-1' } },
        select: expect.objectContaining({
          deliveries: expect.any(Object),
          user: expect.any(Object),
        }),
      }),
    );
  });

  it('lists retained booking chat messages on demand with a hard limit', async () => {
    const retainedMessages = Array.from(
      { length: ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT + 1 },
      (_, index) => ({
        id: `message-${index + 1}`,
        body: `Message ${index + 1}`,
        createdAt: new Date(`2026-06-13T03:${String(index % 60).padStart(2, '0')}:00.000Z`),
      }),
    );
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          chatRoom: {
            id: 'chat-room-1',
            messages: retainedMessages,
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listBookingChatMessages('booking-1')).resolves.toMatchObject({
      bookingId: 'booking-1',
      chatRoomId: 'chat-room-1',
      limit: ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT,
      messages: retainedMessages.slice(0, ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT),
      truncated: true,
    });

    expect(prisma.booking.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        select: expect.objectContaining({
          chatRoom: {
            select: expect.objectContaining({
              messages: expect.objectContaining({
                take: ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT + 1,
              }),
            }),
          },
        }),
      }),
    );
  });

  it('rejects retained booking chat lookup for unknown bookings', async () => {
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listBookingChatMessages('missing-booking')).rejects.toThrow('Booking not found');
  });

  it('lists booking marketplace provider candidates without loading the full Partner directory', async () => {
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          preferredProviderId: 'preferred-partner',
          selectedProviderId: 'selected-partner',
          lat: 10.77,
          lng: 106.7,
          addressSnapshot: null,
          participants: [
            { providerProfileId: 'selected-partner' },
            { providerProfileId: 'marketplace-partner' },
          ],
        }),
      },
      providerProfile: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: 'preferred-partner' }, { id: 'selected-partner' }])
          .mockResolvedValueOnce([{ id: 'selected-partner' }, { id: 'nearby-partner' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listBookingMarketplaceProviders('booking-1', { take: '40' })).resolves.toEqual([
      { id: 'preferred-partner' },
      { id: 'selected-partner' },
      { id: 'nearby-partner' },
    ]);

    expect(prisma.booking.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        select: expect.objectContaining({
          addressSnapshot: { select: { latitude: true, longitude: true } },
          participants: { select: { providerProfileId: true } },
        }),
      }),
    );
    expect(prisma.providerProfile.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: { in: ['preferred-partner', 'selected-partner', 'marketplace-partner'] } },
      }),
    );
    expect(prisma.providerProfile.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 40,
        where: expect.objectContaining({
          currentLat: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
          currentLng: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
        }),
      }),
    );
  });

  it('returns Vietnam overview aggregates with stored event-location points', async () => {
    const now = new Date();
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'customer-1',
            addresses: ['85/9 Pham Viet Chanh, Ho Chi Minh City'],
            selectedLocations: [
              {
                id: 'location-1',
                addressText: '85/9 Pham Viet Chanh, Ho Chi Minh City',
                latitude: 10.7769,
                longitude: 106.7009,
                createdAt: now,
              },
            ],
            user: {
              appSessions: [
                {
                  lastLoginAddress: 'Ho Chi Minh City',
                  lastSeenAt: now,
                },
              ],
            },
          },
        ]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'provider-1',
            displayName: 'Smoke Partner',
            city: 'Ho Chi Minh City',
            residentialAddress: null,
            serviceArea: null,
            status: ProviderStatus.ONLINE_AVAILABLE,
            currentLat: 10.7769,
            currentLng: 106.7009,
            currentLocationUpdatedAt: now,
          },
        ]),
      },
      booking: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'booking-1',
              status: BookingStatus.OPEN_MATCHING,
              address: '85/9 Pham Viet Chanh, Ho Chi Minh City',
              lat: 10.7769,
              lng: 106.7009,
              createdAt: now,
              updatedAt: now,
              closedAt: now,
              addressSnapshot: {
                address: null,
                addressText: '85/9 Pham Viet Chanh, Ho Chi Minh City',
                latitude: 10.7769,
                longitude: 106.7009,
              },
              payment: null,
            },
            {
              id: 'booking-closed',
              status: BookingStatus.COMPLETED,
              address: '85/9 Pham Viet Chanh, Ho Chi Minh City',
              lat: 10.7769,
              lng: 106.7009,
              createdAt: now,
              updatedAt: now,
              closedAt: now,
              addressSnapshot: {
                address: null,
                addressText: '85/9 Pham Viet Chanh, Ho Chi Minh City',
                latitude: 10.7769,
                longitude: 106.7009,
              },
              payment: null,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'booking-2',
              address: '22 Le Thanh Ton, District 1, Ho Chi Minh City',
              lat: 10.7758,
              lng: 106.701,
              createdAt: now,
              updatedAt: now,
              addressSnapshot: {
                address: null,
                addressText: '22 Le Thanh Ton, District 1, Ho Chi Minh City',
                latitude: 10.7758,
                longitude: 106.701,
              },
            },
          ]),
      },
    };
    const service = createAdminService(prisma);

    const overview = await service.getVietnamOverview('today');
    const hcm = overview.regions.find((region) => region.regionCode === 'hcm');
    const serialized = JSON.stringify(overview);

    expect(overview).toMatchObject({
      refreshSeconds: 60,
      source: 'stored-address-aggregates',
    });
    expect(hcm).toMatchObject({
      activeBookingCount: 1,
      customerCount: 1,
      partnerCount: 1,
      completedBookingCount: 1,
    });
    expect(overview.realtimePoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'active',
          latitude: 10.7769,
          longitude: 106.7009,
          customerProfileId: 'customer-1',
        }),
        expect.objectContaining({
          kind: 'online',
          latitude: 10.7769,
          longitude: 106.7009,
          providerProfileId: 'provider-1',
        }),
        expect.objectContaining({
          bookingId: 'booking-2',
          kind: 'bookings',
          latitude: 10.7758,
          longitude: 106.701,
          source: 'booking-address-snapshot',
        }),
      ]),
    );
    expect(overview.points).toEqual([]);
    expect(overview.realtimePoints.map((point) => point.kind).sort()).toEqual([
      'active',
      'bookings',
      'online',
    ]);
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.booking.findMany.mock.calls.map(([query]) => query.take)).toEqual([50, 50]);
    expect(serialized).toContain('latitude');
    expect(serialized).toContain('longitude');
    expect(serialized).not.toContain('currentLat');
    expect(serialized).not.toContain('currentLng');
  });

  it('returns Vietnam overview summary without realtime point payloads', async () => {
    const now = new Date();
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'customer-1',
            addresses: ['85/9 Pham Viet Chanh, Ho Chi Minh City'],
            selectedLocations: [
              {
                id: 'location-1',
                addressText: '85/9 Pham Viet Chanh, Ho Chi Minh City',
                latitude: 10.7769,
                longitude: 106.7009,
                createdAt: now,
              },
            ],
            user: {
              appSessions: [
                {
                  lastLoginAddress: 'Ho Chi Minh City',
                  lastSeenAt: now,
                },
              ],
            },
          },
        ]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'provider-1',
            displayName: 'Smoke Partner',
            city: 'Ho Chi Minh City',
            residentialAddress: null,
            serviceArea: null,
            status: ProviderStatus.ONLINE_AVAILABLE,
            currentLat: 10.7769,
            currentLng: 106.7009,
            currentLocationUpdatedAt: now,
          },
        ]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
    };
    const service = createAdminService(prisma);

    const summary = await service.getVietnamOverviewSummary('today');

    expect(summary.points).toEqual([]);
    expect(summary).not.toHaveProperty('realtimePoints');
    expect(summary.totals).toMatchObject({
      activeCustomerCount: 1,
      onlinePartnerCount: 1,
    });
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('returns Vietnam realtime points without period metric queries', async () => {
    const now = new Date();
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'booking-2',
            address: '22 Le Thanh Ton, District 1, Ho Chi Minh City',
            lat: 10.7758,
            lng: 106.701,
            createdAt: now,
            updatedAt: now,
            addressSnapshot: {
              address: null,
              addressText: '22 Le Thanh Ton, District 1, Ho Chi Minh City',
              latitude: 10.7758,
              longitude: 106.701,
            },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    const pointFeed = await service.getVietnamOverviewRealtimePoints('today');

    expect(pointFeed).toMatchObject({
      refreshSeconds: 60,
      source: 'stored-address-aggregates',
      realtimePoints: [
        expect.objectContaining({
          bookingId: 'booking-2',
          kind: 'bookings',
          latitude: 10.7758,
          longitude: 106.701,
        }),
      ],
    });
    expect(pointFeed).not.toHaveProperty('totals');
    expect(pointFeed).not.toHaveProperty('regions');
    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user: {
            appSessions: {
              some: expect.objectContaining({
                active: true,
                lastSeenAt: { gte: expect.any(Date) },
                role: Role.CUSTOMER,
              }),
            },
          },
        },
      }),
    );
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          currentLocationUpdatedAt: { gte: expect.any(Date) },
          status: { not: ProviderStatus.OFFLINE },
        },
      }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        where: {
          status: expect.objectContaining({
            in: expect.arrayContaining([BookingStatus.OPEN_MATCHING]),
          }),
        },
      }),
    );
  });

  it('clamps Vietnam realtime point feed source reads', async () => {
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.getVietnamOverviewRealtimePoints('today', { take: '500' });

    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('keeps Vietnam realtime customer points current even when the period range is all', async () => {
    const now = new Date();
    const staleSeenAt = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'fresh-customer',
            addresses: ['85/9 Pham Viet Chanh, Ho Chi Minh City'],
            selectedLocations: [
              {
                id: 'fresh-location',
                addressText: '85/9 Pham Viet Chanh, Ho Chi Minh City',
                latitude: 10.7769,
                longitude: 106.7009,
                createdAt: now,
              },
            ],
            user: {
              appSessions: [
                {
                  lastLoginAddress: 'Ho Chi Minh City',
                  lastSeenAt: now,
                },
              ],
            },
          },
          {
            id: 'stale-customer',
            addresses: ['159 P. Chua Lang, Ha Noi'],
            selectedLocations: [
              {
                id: 'stale-location',
                addressText: '159 P. Chua Lang, Ha Noi',
                latitude: 21.0278,
                longitude: 105.8342,
                createdAt: staleSeenAt,
              },
            ],
            user: {
              appSessions: [
                {
                  lastLoginAddress: 'Ha Noi',
                  lastSeenAt: staleSeenAt,
                },
              ],
            },
          },
        ]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    const pointFeed = await service.getVietnamOverviewRealtimePoints('all');

    expect(pointFeed.realtimePoints).toEqual([
      expect.objectContaining({
        customerProfileId: 'fresh-customer',
        kind: 'active',
      }),
    ]);
    expect(pointFeed.realtimePoints).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerProfileId: 'stale-customer',
        }),
      ]),
    );
  });

  it('adds server-computed activity summaries to provider list rows', async () => {
    const latestWorkAt = new Date('2026-06-20T10:00:00.000Z');
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'provider-1', displayName: 'Linh Wellness' }]),
      },
      providerEarning: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { grossAmount: 1_200_000, platformFee: 240_000 },
            },
          ])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { netAmount: 700_000 },
            },
          ])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { netAmount: 450_000 },
            },
          ])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { netAmount: -120_000 },
            },
          ])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _count: { _all: 3 },
              _max: {
                paidAt: latestWorkAt,
                availableAt: null,
                createdAt: new Date('2026-06-19T10:00:00.000Z'),
              },
            },
          ]),
      },
      adminAuditLog: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const service = createAdminService(prisma);

    await expect(service.listProviders()).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-1',
        activitySummary: {
          availablePayout: 450_000,
          completedWorkCount: 3,
          grossRevenue: 1_200_000,
          lastCompletedWorkAt: latestWorkAt,
          pendingPayout: 700_000,
          platformFee: 240_000,
          walletBalance: -120_000,
        },
      }),
    ]);
  });

  it('adds server-computed booking summaries to provider list rows', async () => {
    const latestBookingAt = new Date('2026-06-20T12:00:00.000Z');
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'provider-1', displayName: 'Linh Wellness' }]),
      },
      providerEarning: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      adminAuditLog: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            providerId: 'provider-1',
            activeBookingCount: 5,
            adminClosedBookingCount: 0,
            bookingCount: 9,
            chatMissingCount: 1,
            chatRoomCount: 4,
            closedBookingCount: 2,
            completedBookingCount: 1,
            customerClosedBookingCount: 1,
            latestBookingAt,
            matchingBookingCount: 2,
            noShowBookingCount: 1,
            participatingBookingCount: 4,
            partnerClosedBookingCount: 1,
            preferredBookingCount: 2,
            selectedBookingCount: 3,
            workingBookingCount: 3,
          },
        ])
        .mockResolvedValueOnce([]),
    };
    const service = createAdminService(prisma);

    await expect(service.listProviders()).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-1',
        bookingSummary: {
          activeBookingCount: 5,
          adminClosedBookingCount: 0,
          bookingCount: 9,
          chatMissingCount: 1,
          chatRoomCount: 4,
          closedBookingCount: 2,
          completedBookingCount: 1,
          customerClosedBookingCount: 1,
          latestBookingAt,
          matchingBookingCount: 2,
          noShowBookingCount: 1,
          participatingBookingCount: 4,
          partnerClosedBookingCount: 1,
          preferredBookingCount: 2,
          selectedBookingCount: 3,
          workingBookingCount: 3,
        },
      }),
    ]);
  });

  it('keeps provider list booking relation windows narrow after summary aggregation', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listProviders();

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          participants: expect.objectContaining({ take: 15 }),
          preferredBookings: expect.objectContaining({ take: 15 }),
          selectedBookings: expect.objectContaining({ take: 15 }),
        }),
      }),
    );
  });

  it('keeps provider list booking relation payload compact after summary aggregation', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listProviders();

    const select = prisma.providerProfile.findMany.mock.calls[0][0].select;
    const compactBookingSelect = {
      id: true,
      status: true,
      scheduledStartAt: true,
      closedByRole: true,
      createdAt: true,
      updatedAt: true,
      chatRoom: { select: { id: true, createdAt: true } },
    };

    expect(select.preferredBookings.select).toEqual(compactBookingSelect);
    expect(select.selectedBookings.select).toEqual(compactBookingSelect);
    expect(select.participants.select).toEqual({
      id: true,
      providerProfileId: true,
      status: true,
      joinedAt: true,
      respondedAt: true,
      booking: { select: compactBookingSelect },
    });
    expect(select.services.select).toEqual({
      id: true,
      active: true,
      service: {
        select: {
          id: true,
          name: true,
          nameTranslations: true,
          active: true,
        },
      },
    });
    expect(select.documents.select).toEqual({
      id: true,
      type: true,
      status: true,
      fileAsset: {
        select: {
          id: true,
          key: true,
          contentType: true,
          uploadedAt: true,
          sizeBytes: true,
        },
      },
    });
    expect(select.bankAccounts.select).toEqual({
      id: true,
      bankName: true,
      accountNumberMasked: true,
      accountHolderName: true,
      status: true,
      isPrimary: true,
      reviewedAt: true,
    });
    expect(select.reports.select).toEqual({
      id: true,
      category: true,
      summary: true,
      details: true,
      severity: true,
      status: true,
      createdAt: true,
    });
    expect(select.sanctions.select).toEqual({
      id: true,
      type: true,
      status: true,
      reason: true,
      createdAt: true,
    });
    expect(select.user.select.fileAssets.select).toEqual({
      id: true,
      key: true,
      url: true,
      contentType: true,
      purpose: true,
      visibility: true,
      uploadStatus: true,
      reviewStatus: true,
      reviewReason: true,
      uploadedAt: true,
      sizeBytes: true,
      createdAt: true,
    });
    expect(select.verification.select.files.select).toEqual({
      id: true,
      key: true,
      contentType: true,
      purpose: true,
      visibility: true,
      uploadStatus: true,
      reviewStatus: true,
      reviewReason: true,
      uploadedAt: true,
      sizeBytes: true,
    });
    expect(select.sessions.select).toEqual({
      id: true,
      deviceId: true,
      ipAddress: true,
      loggedInAt: true,
      lastSeenAt: true,
      suspicious: true,
    });
    expect(select.devices.select).toEqual({
      id: true,
      deviceId: true,
      platform: true,
      enabled: true,
      lastSeenAt: true,
      blockedAt: true,
      createdAt: true,
      updatedAt: true,
    });
  });

  it('lists partner directory providers without loading per-booking or earning rows', async () => {
    const latestBookingAt = new Date('2026-06-20T12:00:00.000Z');
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'provider-1', displayName: 'Directory Partner' }]),
      },
      providerEarning: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { netAmount: -80000 },
            },
          ])
          .mockResolvedValueOnce([]),
      },
      adminAuditLog: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            providerId: 'provider-1',
            activeBookingCount: 2,
            adminClosedBookingCount: 0,
            bookingCount: 7,
            chatMissingCount: 0,
            chatRoomCount: 2,
            closedBookingCount: 1,
            completedBookingCount: 3,
            customerClosedBookingCount: 0,
            latestBookingAt,
            matchingBookingCount: 1,
            noShowBookingCount: 0,
            participatingBookingCount: 2,
            partnerClosedBookingCount: 1,
            preferredBookingCount: 1,
            selectedBookingCount: 2,
            workingBookingCount: 1,
          },
        ])
        .mockResolvedValueOnce([]),
    };
    const service = createAdminService(prisma);

    await expect(service.listPartnerDirectoryProviders()).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-1',
        activitySummary: expect.objectContaining({ walletBalance: -80000 }),
        bookingSummary: expect.objectContaining({
          bookingCount: 7,
          latestBookingAt,
          preferredBookingCount: 1,
        }),
      }),
    ]);

    const query = prisma.providerProfile.findMany.mock.calls[0][0];
    const select = query.select;
    expect(query).toEqual(expect.objectContaining({ take: 50 }));
    expect(select.preferredBookings).toBeUndefined();
    expect(select.selectedBookings).toBeUndefined();
    expect(select.participants).toBeUndefined();
    expect(select.earnings).toBeUndefined();
    expect(select.services).toBeDefined();
    expect(select.documents).toBeDefined();
    expect(select.user.select.fileAssets).toBeDefined();
    expect(select.user.select.pushDevices.take).toBe(2);
    expect(select.sessions.take).toBe(3);
    expect(select.devices.take).toBe(3);
  });

  it('supports bounded partner directory paging and text search before loading row details', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        q: 'linh',
        skip: '50',
        take: '25',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { id: 'desc' },
        skip: 50,
        take: 25,
        where: {
          OR: [
            { displayName: { contains: 'linh', mode: 'insensitive' } },
            { legalName: { contains: 'linh', mode: 'insensitive' } },
            { activityNickname: { contains: 'linh', mode: 'insensitive' } },
            { city: { contains: 'linh', mode: 'insensitive' } },
            {
              user: {
                OR: [
                  { fullName: { contains: 'linh', mode: 'insensitive' } },
                  { phone: { contains: 'linh', mode: 'insensitive' } },
                  { email: { contains: 'linh', mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
      }),
    );
  });

  it('supports unapproved partner directory filtering before loading row details', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        review: 'unapproved',
        take: '25',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: {
          OR: expect.arrayContaining([
            { blockedAt: { not: null } },
            { verification: { is: null } },
            { verification: { is: { status: { not: 'APPROVED' } } } },
            { kyc: { is: null } },
            { kyc: { is: { status: { not: 'APPROVED' } } } },
            { documents: { some: { status: { in: ['PENDING_REVIEW', 'REJECTED'] } } } },
            { documents: { none: { type: 'CCCD_FRONT', status: 'APPROVED' } } },
            { documents: { none: { type: 'CCCD_BACK', status: 'APPROVED' } } },
            { documents: { none: { type: 'SELFIE', status: 'APPROVED' } } },
            {
              user: {
                fileAssets: {
                  some: {
                    purpose: { in: ['PROFILE_IMAGE', 'PROVIDER_GALLERY'] },
                    uploadStatus: 'UPLOADED',
                    visibility: 'PUBLIC',
                    reviewStatus: { in: ['PENDING_REVIEW', 'REJECTED'] },
                  },
                },
              },
            },
          ]),
        },
      }),
    );
  });

  it('supports simple partner state filters before loading row details', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        kyc: 'APPROVED',
        providerStatus: 'ONLINE_AVAILABLE',
        take: '10',
        verification: 'SUBMITTED',
      }),
    ).resolves.toEqual([]);
    await expect(
      service.partnerDirectorySummary({
        kyc: 'APPROVED',
        providerStatus: 'ONLINE_AVAILABLE',
        verification: 'SUBMITTED',
      }),
    ).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 0,
    });

    const expectedWhere = {
      AND: [
        { verification: { is: { status: 'SUBMITTED' } } },
        { status: 'ONLINE_AVAILABLE' },
        { kyc: { is: { status: 'APPROVED' } } },
      ],
    };
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expectedWhere,
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('supports server-side partner name sorting before loading row details', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        sort: 'name',
        take: '10',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ displayName: 'asc' }, { legalName: 'asc' }, { id: 'asc' }],
        take: 10,
      }),
    );
  });

  it('treats verification BLOCKED as account blocked in the partner directory query', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        take: '10',
        verification: 'BLOCKED',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: { blockedAt: { not: null } },
      }),
    );
  });

  it('supports blocked partner directory filtering before loading row details', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(2),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        review: 'blocked',
        take: '10',
      }),
    ).resolves.toEqual([]);
    await expect(service.partnerDirectorySummary({ review: 'blocked' })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 2,
    });

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: { blockedAt: { not: null } },
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: { blockedAt: { not: null } },
    });
  });

  it.each([
    [
      'documents',
      {
        documents: {
          some: {
            status: { in: ['PENDING_REVIEW', 'REJECTED'] },
          },
        },
      },
    ],
    [
      'public-media',
      {
        user: {
          fileAssets: {
            some: {
              purpose: { in: ['PROFILE_IMAGE', 'PROVIDER_GALLERY'] },
              uploadStatus: 'UPLOADED',
              visibility: 'PUBLIC',
              reviewStatus: { in: ['PENDING_REVIEW', 'REJECTED'] },
            },
          },
        },
      },
    ],
    [
      'bank',
      {
        AND: [
          { bankAccounts: { some: {} } },
          { bankAccounts: { none: { status: 'APPROVED' } } },
        ],
      },
    ],
  ])('supports %s partner directory filtering before loading row details', async (review, expectedWhere) => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(3),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        review,
        take: '10',
      }),
    ).resolves.toEqual([]);
    await expect(service.partnerDirectorySummary({ review })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 3,
    });

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expectedWhere,
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it.each([
    [
      'tax',
      {
        taxProfile: {
          is: {
            status: { in: ['PENDING_REVIEW', 'REJECTED'] },
          },
        },
      },
    ],
    [
      'reports',
      {
        OR: [
          { reports: { some: { status: { in: ['OPEN', 'INVESTIGATING'] } } } },
          { sanctions: { some: { status: 'ACTIVE' } } },
        ],
      },
    ],
  ])('supports %s partner directory filtering before loading row details', async (review, expectedWhere) => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(4),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        review,
        take: '10',
      }),
    ).resolves.toEqual([]);
    await expect(service.partnerDirectorySummary({ review })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 4,
    });

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expectedWhere,
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it.each([
    [
      'kyc',
      {
        OR: [
          { kyc: { is: null } },
          { kyc: { is: { status: { not: 'APPROVED' } } } },
          {
            documents: {
              some: {
                type: { in: ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'] },
                status: { in: ['PENDING_REVIEW', 'REJECTED'] },
              },
            },
          },
        ],
      },
    ],
    [
      'push',
      {
        user: {
          pushDevices: {
            none: {
              enabled: true,
            },
          },
        },
      },
    ],
  ])('supports %s partner directory filtering before loading row details', async (review, expectedWhere) => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(5),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        review,
        take: '10',
      }),
    ).resolves.toEqual([]);
    await expect(service.partnerDirectorySummary({ review })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 5,
    });

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expectedWhere,
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('supports unsettled partner directory filtering from wallet aggregation before loading row details', async () => {
    const prisma = {
      providerEarning: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'provider-negative',
            _sum: { netAmount: -120000 },
          },
        ]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        review: 'unsettled',
        take: '25',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerEarning.groupBy).toHaveBeenCalledWith({
      by: ['providerProfileId'],
      where: {
        payoutBatchId: null,
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
      },
      _sum: { netAmount: true },
    });
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: {
          id: { in: ['provider-negative'] },
        },
      }),
    );
  });

  it('supports cash-debt partner directory filtering from wallet aggregation before loading row details', async () => {
    const prisma = {
      providerEarning: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'provider-cash-debt',
            _sum: { netAmount: -65000 },
          },
        ]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        review: 'cash-debt',
        take: '10',
      }),
    ).resolves.toEqual([]);
    await expect(service.partnerDirectorySummary({ review: 'cash-debt' })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 1,
    });

    expect(prisma.providerEarning.groupBy).toHaveBeenCalledWith({
      by: ['providerProfileId'],
      where: {
        payoutBatchId: null,
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
      },
      _sum: { netAmount: true },
    });
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: {
          id: { in: ['provider-cash-debt'] },
        },
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: {
        id: { in: ['provider-cash-debt'] },
      },
    });
  });

  it.each([
    [
      'active-booking',
      {
        OR: [
          { preferredBookings: { some: { status: { in: ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'] } } } },
          { selectedBookings: { some: { status: { in: ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'] } } } },
          { participants: { some: { booking: { status: { in: ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'] } } } } },
        ],
      },
    ],
    ['first-pick', { preferredBookings: { some: {} } }],
    ['marketplace-joined', { participants: { some: {} } }],
    ['final-partner', { selectedBookings: { some: {} } }],
    [
      'chat-live',
      {
        OR: [
          { preferredBookings: { some: { chatRoom: { isNot: null } } } },
          { selectedBookings: { some: { chatRoom: { isNot: null } } } },
          { participants: { some: { booking: { chatRoom: { isNot: null } } } } },
        ],
      },
    ],
    [
      'chat-missing',
      {
        OR: [
          { preferredBookings: { some: { status: { in: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'] }, chatRoom: { is: null } } } },
          { selectedBookings: { some: { status: { in: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'] }, chatRoom: { is: null } } } },
          { participants: { some: { booking: { status: { in: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'] }, chatRoom: { is: null } } } } },
        ],
      },
    ],
    [
      'completed-work',
      {
        OR: [
          { preferredBookings: { some: { status: 'COMPLETED' } } },
          { selectedBookings: { some: { status: 'COMPLETED' } } },
          { participants: { some: { booking: { status: 'COMPLETED' } } } },
        ],
      },
    ],
    [
      'no-work',
      {
        AND: [
          { preferredBookings: { none: { status: 'COMPLETED' } } },
          { selectedBookings: { none: { status: 'COMPLETED' } } },
          { participants: { none: { booking: { status: 'COMPLETED' } } } },
        ],
      },
    ],
  ])('supports %s booking flow filtering before loading row details', async (bookingFlow, expectedWhere) => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(6),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerDirectoryProviders({
        bookingFlow,
        take: '10',
      }),
    ).resolves.toEqual([]);
    await expect(service.partnerDirectorySummary({ bookingFlow })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 6,
    });

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expectedWhere,
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('exposes partner directory summary counts through the same safe filters', async () => {
    const prisma = {
      providerProfile: {
        count: vi.fn().mockResolvedValue(32),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.partnerDirectorySummary({ q: 'linh' })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 32,
    });

    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { displayName: { contains: 'linh', mode: 'insensitive' } },
          { legalName: { contains: 'linh', mode: 'insensitive' } },
          { activityNickname: { contains: 'linh', mode: 'insensitive' } },
          { city: { contains: 'linh', mode: 'insensitive' } },
          {
            user: {
              OR: [
                { fullName: { contains: 'linh', mode: 'insensitive' } },
                { phone: { contains: 'linh', mode: 'insensitive' } },
                { email: { contains: 'linh', mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
    });
  });

  it('exposes unapproved partner directory summary counts through the same safe filters', async () => {
    const prisma = {
      providerProfile: {
        count: vi.fn().mockResolvedValue(9),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.partnerDirectorySummary({ review: 'unapproved' })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 9,
    });

    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: {
        OR: expect.arrayContaining([
          { blockedAt: { not: null } },
          { verification: { is: null } },
          { verification: { is: { status: { not: 'APPROVED' } } } },
          { kyc: { is: null } },
          { kyc: { is: { status: { not: 'APPROVED' } } } },
          { documents: { some: { status: { in: ['PENDING_REVIEW', 'REJECTED'] } } } },
          { documents: { none: { type: 'CCCD_FRONT', status: 'APPROVED' } } },
          { documents: { none: { type: 'CCCD_BACK', status: 'APPROVED' } } },
          { documents: { none: { type: 'SELFIE', status: 'APPROVED' } } },
          {
            user: {
              fileAssets: {
                some: {
                  purpose: { in: ['PROFILE_IMAGE', 'PROVIDER_GALLERY'] },
                  uploadStatus: 'UPLOADED',
                  visibility: 'PUBLIC',
                  reviewStatus: { in: ['PENDING_REVIEW', 'REJECTED'] },
                },
              },
            },
          },
        ]),
      },
    });
  });

  it('exposes unsettled partner directory summary counts from wallet aggregation', async () => {
    const prisma = {
      providerEarning: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'provider-negative',
            _sum: { netAmount: -90000 },
          },
        ]),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.partnerDirectorySummary({ review: 'unsettled' })).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 1,
    });

    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: {
        id: { in: ['provider-negative'] },
      },
    });
  });

  it('lists file review providers without loading full partner operations payload', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listFileReviewProviders()).resolves.toEqual([]);

    const query = prisma.providerProfile.findMany.mock.calls[0][0];
    const select = query.select;
    expect(query).toEqual(
      expect.objectContaining({
        take: 50,
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
    expect(select).toEqual(
      expect.objectContaining({
        id: true,
        displayName: true,
        status: true,
      }),
    );
    expect(select.preferredBookings).toBeUndefined();
    expect(select.selectedBookings).toBeUndefined();
    expect(select.participants).toBeUndefined();
    expect(select.earnings).toBeUndefined();
    expect(select.reports).toBeUndefined();
    expect(select.sanctions).toBeUndefined();
    expect(select.auditLogs).toBeUndefined();
    expect(select.user.select.fileAssets.take).toBe(20);
    expect(select.verification.select.files.take).toBe(20);
  });

  it('applies pagination to file review provider hydration', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listFileReviewProviders({ skip: '50', take: '25' })).resolves.toEqual([]);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 25,
      }),
    );
  });

  it('counts file review summary without hydrating partner rows', async () => {
    const prisma = {
      fileAsset: {
        count: vi
          .fn()
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValue(6),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.fileReviewSummary()).resolves.toEqual({
      approved: 5,
      generatedAt: expect.any(String),
      pendingReview: 7,
      privateFiles: 8,
      publicMedia: 4,
      rejected: 2,
      total: 12,
      totalProviders: 6,
      uploadIncomplete: 3,
    });

    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    });
    expect(prisma.fileAsset.count).toHaveBeenCalledTimes(5);
    expect(prisma.providerProfile.findMany).toBeUndefined();
  });

  it('lists operations policy providers without loading full partner operations payload', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'provider-1', displayName: 'Policy Partner' }]),
      },
      providerEarning: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { netAmount: -120000 },
            },
          ])
          .mockResolvedValueOnce([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listOperationsPolicyProviders({ take: '50' })).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-1',
        activitySummary: expect.objectContaining({ walletBalance: -120000 }),
        earnings: [{ netAmount: -120000 }],
      }),
    ]);

    const query = prisma.providerProfile.findMany.mock.calls[0][0];
    const select = query.select;
    expect(query).toEqual(
      expect.objectContaining({
        take: 50,
      }),
    );
    expect(select).toEqual(
      expect.objectContaining({
        id: true,
        displayName: true,
        status: true,
        currentLat: true,
        currentLng: true,
        currentLocationUpdatedAt: true,
        blockedAt: true,
      }),
    );
    expect(select.preferredBookings).toBeUndefined();
    expect(select.selectedBookings).toBeUndefined();
    expect(select.participants).toBeUndefined();
    expect(select.earnings).toBeUndefined();
    expect(select.reports).toBeUndefined();
    expect(select.services).toBeUndefined();
    expect(select.user.select.fileAssets).toBeUndefined();
    expect(select.verification.select.files).toBeUndefined();
    expect(select.user.select.pushDevices.take).toBe(2);
    expect(select.bankAccounts.take).toBe(1);
  });

  it('lists operations handoff providers without loading full partner operations payload', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'provider-1', displayName: 'Handoff Partner' }]),
      },
      providerEarning: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { netAmount: -90000 },
            },
          ])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _count: { _all: 4 },
              _max: { paidAt: new Date('2026-06-20T10:00:00.000Z'), availableAt: null, createdAt: null },
            },
          ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listOperationsHandoffProviders({ take: '5' })).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-1',
        activitySummary: expect.objectContaining({
          completedWorkCount: 4,
          walletBalance: -90000,
        }),
      }),
    ]);

    const query = prisma.providerProfile.findMany.mock.calls[0][0];
    const select = query.select;
    expect(query).toEqual(expect.objectContaining({ take: 5 }));
    expect(select).toEqual(
      expect.objectContaining({
        id: true,
        displayName: true,
        status: true,
        currentLocationUpdatedAt: true,
        blockedAt: true,
      }),
    );
    expect(select.preferredBookings).toBeUndefined();
    expect(select.selectedBookings).toBeUndefined();
    expect(select.earnings).toBeUndefined();
    expect(select.reports).toBeUndefined();
    expect(select.services).toBeUndefined();
    expect(select.user.select.fileAssets).toBeUndefined();
    expect(select.verification.select.files).toBeUndefined();
    expect(select.user.select.pushDevices.take).toBe(2);
    expect(select.participants.select).toEqual({
      id: true,
      providerProfileId: true,
      status: true,
    });
    expect(select.participants.take).toBe(15);
    expect(select.bankAccounts.take).toBe(3);
  });

  it('lists partner control providers without loading full partner operations payload', async () => {
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'provider-1', displayName: 'Control Partner' }]),
      },
      providerEarning: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              providerProfileId: 'provider-1',
              _sum: { netAmount: -70000 },
            },
          ])
          .mockResolvedValueOnce([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listPartnerControlProviders({ take: '7' })).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-1',
        activitySummary: expect.objectContaining({ walletBalance: -70000 }),
        earnings: [{ netAmount: -70000, status: EarningStatus.PENDING }],
      }),
    ]);

    const query = prisma.providerProfile.findMany.mock.calls[0][0];
    const select = query.select;
    expect(query).toEqual(expect.objectContaining({ take: 7 }));
    expect(select).toEqual(
      expect.objectContaining({
        id: true,
        displayName: true,
        legalName: true,
        status: true,
        currentLat: true,
        currentLng: true,
        currentLocationUpdatedAt: true,
        blockedAt: true,
        blockedReason: true,
      }),
    );
    expect(select.preferredBookings).toBeUndefined();
    expect(select.selectedBookings).toBeUndefined();
    expect(select.services).toBeUndefined();
    expect(select.earnings).toBeUndefined();
    expect(select.documents).toBeUndefined();
    expect(select.user.select.fileAssets).toBeUndefined();
    expect(select.verification.select.files).toBeUndefined();
    expect(select.user.select.pushDevices.take).toBe(2);
    expect(select.participants.select).toEqual({
      id: true,
      providerProfileId: true,
      status: true,
    });
    expect(select.participants.take).toBe(15);
    expect(select.reports.take).toBe(5);
    expect(select.sanctions.take).toBe(5);
    expect(select.devices.take).toBe(5);
    expect(select.sessions.take).toBe(3);
  });

  it('summarizes partner controls with aggregate queries before loading provider rows', async () => {
    const prisma = {
      providerReport: {
        count: vi
          .fn()
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(7),
      },
      providerSanction: {
        count: vi.fn().mockResolvedValue(3),
      },
      providerProfile: {
        count: vi
          .fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5),
        findMany: vi.fn(),
      },
      providerEarning: {
        groupBy: vi.fn().mockResolvedValue([
          { providerProfileId: 'provider-negative', _sum: { netAmount: -70000 } },
          { providerProfileId: 'provider-positive', _sum: { netAmount: 20000 } },
        ]),
      },
      providerDevice: {
        groupBy: vi.fn().mockResolvedValue([
          { deviceId: 'device-shared', _count: { providerProfileId: 2 } },
          { deviceId: 'device-single', _count: { providerProfileId: 1 } },
        ]),
        findMany: vi.fn().mockResolvedValue([
          { providerProfileId: 'provider-1' },
          { providerProfileId: 'provider-2' },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.partnerControlSummary()).resolves.toEqual({
      activeControls: 3,
      blockedAccounts: 2,
      locationGaps: 4,
      onboardingGaps: 5,
      openReports: 6,
      sharedDevices: 2,
      urgentMajorReports: 7,
      walletDebt: 1,
    });

    expect(prisma.providerProfile.findMany).not.toHaveBeenCalled();
    expect(prisma.providerReport.count).toHaveBeenCalledWith({
      where: { status: { in: [ProviderReportStatus.OPEN, ProviderReportStatus.INVESTIGATING] } },
    });
    expect(prisma.providerReport.count).toHaveBeenCalledWith({
      where: { severity: { in: [ProviderReportSeverity.CRITICAL, ProviderReportSeverity.HIGH] } },
    });
    expect(prisma.providerSanction.count).toHaveBeenCalledWith({
      where: { status: ProviderSanctionStatus.ACTIVE },
    });
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: { blockedAt: { not: null } },
    });
    expect(prisma.providerProfile.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { currentLat: null },
            { currentLng: null },
            { currentLocationUpdatedAt: null },
            { currentLocationUpdatedAt: { lt: expect.any(Date) } },
          ]),
          status: {
            in: [
              ProviderStatus.ONLINE_AVAILABLE,
              ProviderStatus.ONLINE_BUSY,
              ProviderStatus.ONLINE_AVAILABLE_SOON,
            ],
          },
        }),
      }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { kyc: { is: null } },
            { kyc: { is: { status: { not: ProviderKycStatus.APPROVED } } } },
            { bankAccounts: { none: { status: ProviderBankAccountStatus.APPROVED } } },
            { taxProfile: { is: null } },
            { taxProfile: { is: { status: { not: ProviderTaxProfileStatus.APPROVED } } } },
          ]),
        }),
      }),
    );
    expect(prisma.providerEarning.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { netAmount: true },
        by: ['providerProfileId'],
        where: {
          payoutBatchId: null,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        },
      }),
    );
    expect(prisma.providerDevice.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        _count: { providerProfileId: true },
        by: ['deviceId'],
        where: { blockedAt: null, enabled: true },
      }),
    );
    expect(prisma.providerDevice.findMany).toHaveBeenCalledWith({
      distinct: ['providerProfileId'],
      select: { providerProfileId: true },
      where: { blockedAt: null, deviceId: { in: ['device-shared'] }, enabled: true },
    });
  });

  it('bounds and filters customer directory queries before loading row details', async () => {
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listCustomers({
        country: 'VN',
        gender: 'female',
        joinedFrom: '2026-06-01',
        joinedTo: '2026-06-27',
        lastBookingFrom: '2026-06-08',
        lastBookingTo: '2026-06-18',
        lastLoginFrom: '2026-06-10',
        lastLoginTo: '2026-06-20',
        q: 'mai',
        skip: '20',
        sort: 'booking-count',
        take: '10',
      }),
    ).resolves.toEqual([]);

    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ bookings: { _count: 'desc' } }, { id: 'desc' }],
        skip: 20,
        take: 10,
        where: {
          gender: { equals: 'female', mode: 'insensitive' },
          bookings: {
            none: {
              updatedAt: {
                gte: new Date('2026-06-19T00:00:00.000Z'),
              },
            },
            some: {
              updatedAt: {
                gte: new Date('2026-06-08T00:00:00.000Z'),
              },
            },
          },
          user: {
            OR: [
              { fullName: { contains: 'mai', mode: 'insensitive' } },
              { phone: { contains: 'mai', mode: 'insensitive' } },
              { email: { contains: 'mai', mode: 'insensitive' } },
            ],
            createdAt: {
              gte: new Date('2026-06-01T00:00:00.000Z'),
              lt: new Date('2026-06-28T00:00:00.000Z'),
            },
            appSessions: {
              some: {
                OR: [
                  { deviceLanguage: { endsWith: '-VN', mode: 'insensitive' } },
                  { deviceLanguage: { equals: 'vi', mode: 'insensitive' } },
                ],
                lastSeenAt: {
                  gte: new Date('2026-06-10T00:00:00.000Z'),
                  lt: new Date('2026-06-21T00:00:00.000Z'),
                },
              },
            },
          },
        },
      }),
    );
    expect(prisma.customerProfile.findMany.mock.calls[0][0].select.bookings.take).toBeLessThanOrEqual(10);
  });

  it('exposes customer directory summary counts through the same safe filters', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T08:30:00.000Z'));

    const prisma = {
      customerProfile: {
        count: vi.fn().mockResolvedValue(42),
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            { gender: 'female', _count: { _all: 24 } },
            { gender: 'male', _count: { _all: 12 } },
            { gender: null, _count: { _all: 6 } },
          ])
          .mockResolvedValueOnce([
            { gender: 'female', _count: { _all: 3 } },
            { gender: 'male', _count: { _all: 1 } },
          ])
          .mockResolvedValueOnce([
            { gender: 'female', _count: { _all: 5 } },
            { gender: 'other', _count: { _all: 1 } },
          ])
          .mockResolvedValueOnce([
            { gender: 'female', _count: { _all: 18 } },
            { gender: 'male', _count: { _all: 9 } },
            { gender: 'non_binary', _count: { _all: 2 } },
          ]),
      },
    };
    const service = createAdminService(prisma);

    try {
      await expect(
        service.customerSummary({
          country: 'VN',
          gender: 'female',
          joinedFrom: '2026-06-01',
          joinedTo: '2026-06-27',
          lastBookingFrom: '2026-06-08',
          lastBookingTo: '2026-06-18',
          lastLoginFrom: '2026-06-10',
          lastLoginTo: '2026-06-20',
          q: 'mai',
        }),
      ).resolves.toEqual({
        generatedAt: expect.any(String),
        totalCount: 42,
        genderBreakdown: { female: 24, male: 12, other: 0, unknown: 6 },
        todayJoined: 4,
        todayJoinedGenderBreakdown: { female: 3, male: 1, other: 0, unknown: 0 },
        todaySeen: 6,
        todaySeenGenderBreakdown: { female: 5, male: 0, other: 1, unknown: 0 },
        monthSeen: 29,
        monthSeenGenderBreakdown: { female: 18, male: 9, other: 0, unknown: 2 },
      });
    } finally {
      vi.useRealTimers();
    }

    expect(prisma.customerProfile.count).toHaveBeenCalledWith({
      where: {
        gender: { equals: 'female', mode: 'insensitive' },
        bookings: {
          none: {
            updatedAt: {
              gte: new Date('2026-06-19T00:00:00.000Z'),
            },
          },
          some: {
            updatedAt: {
              gte: new Date('2026-06-08T00:00:00.000Z'),
            },
          },
        },
        user: {
          OR: [
            { fullName: { contains: 'mai', mode: 'insensitive' } },
            { phone: { contains: 'mai', mode: 'insensitive' } },
            { email: { contains: 'mai', mode: 'insensitive' } },
          ],
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lt: new Date('2026-06-28T00:00:00.000Z'),
          },
          appSessions: {
            some: {
              OR: [
                { deviceLanguage: { endsWith: '-VN', mode: 'insensitive' } },
                { deviceLanguage: { equals: 'vi', mode: 'insensitive' } },
              ],
              lastSeenAt: {
                gte: new Date('2026-06-10T00:00:00.000Z'),
                lt: new Date('2026-06-21T00:00:00.000Z'),
              },
            },
          },
        },
      },
    });
    expect(prisma.customerProfile.groupBy).toHaveBeenCalledTimes(4);
    expect(prisma.customerProfile.groupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        by: ['gender'],
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              user: expect.objectContaining({
                createdAt: {
                  gte: new Date('2026-06-27T17:00:00.000Z'),
                  lt: new Date('2026-06-28T17:00:00.000Z'),
                },
              }),
            }),
          ]),
        }),
      }),
    );
    expect(prisma.customerProfile.groupBy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        by: ['gender'],
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              user: {
                appSessions: {
                  some: {
                    lastSeenAt: {
                      gte: new Date('2026-06-27T17:00:00.000Z'),
                      lt: new Date('2026-06-28T17:00:00.000Z'),
                    },
                  },
                },
              },
            }),
          ]),
        }),
      }),
    );
  });

  it('adds server-computed activity summaries to customer list rows', async () => {
    const lastBookingAt = new Date('2026-06-20T12:00:00.000Z');
    const lastCompletedBookingAt = new Date('2026-06-19T12:00:00.000Z');
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'customer-1',
            userId: 'user-1',
            bookings: [{ id: 'recent-booking-only', status: BookingStatus.CREATED }],
          },
        ]),
      },
      booking: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            {
              customerProfileId: 'customer-1',
              _count: { _all: 17 },
              _max: { updatedAt: lastBookingAt, createdAt: new Date('2026-06-20T10:00:00.000Z') },
            },
          ])
          .mockResolvedValueOnce([
            {
              customerProfileId: 'customer-1',
              _count: { _all: 12 },
              _max: {
                updatedAt: lastCompletedBookingAt,
                createdAt: new Date('2026-06-19T10:00:00.000Z'),
              },
            },
          ])
          .mockResolvedValueOnce([
            {
              customerProfileId: 'customer-1',
              status: BookingStatus.CREATED,
              closedByRole: null,
              _count: { _all: 2 },
            },
            {
              customerProfileId: 'customer-1',
              status: BookingStatus.OPEN_MATCHING,
              closedByRole: null,
              _count: { _all: 3 },
            },
            {
              customerProfileId: 'customer-1',
              status: BookingStatus.CANCELLED,
              closedByRole: Role.PROVIDER,
              _count: { _all: 4 },
            },
            {
              customerProfileId: 'customer-1',
              status: BookingStatus.NO_SHOW,
              closedByRole: null,
              _count: { _all: 1 },
            },
          ]),
      },
      adminAuditLog: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const service = createAdminService(prisma);

    await expect(service.listCustomers()).resolves.toEqual([
      expect.objectContaining({
        id: 'customer-1',
        activitySummary: {
          activeBookingCount: 5,
          adminClosedBookingCount: 0,
          bookingCount: 17,
          closedBookingCount: 5,
          completedBookingCount: 12,
          customerClosedBookingCount: 0,
          lastBookingAt,
          lastCompletedBookingAt,
          noShowBookingCount: 1,
          partnerClosedBookingCount: 4,
        },
      }),
    ]);
    expect(prisma.booking.groupBy).toHaveBeenCalledTimes(3);
  });

  it('includes persisted matching decision fields in partner overview booking queries', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }),
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

  it('keeps partner detail audit trail bounded for full detail screens', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'provider-1',
          devices: [],
          sessions: [],
        }),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([{ id: 'audit-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getProviderDetail('provider-1')).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [{ id: 'audit-1' }],
        sharedDeviceMatches: [],
      }),
    );

    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ target: 'provider:provider-1' }]),
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
        findUnique: vi.fn().mockResolvedValue(providerProfile),
      },
      providerDevice: {
        findMany: vi.fn().mockReturnValue(sharedDevices.promise),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
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

  it('keeps partner detail shared-device preview bounded', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'provider-1',
          devices: [{ deviceId: 'device-a' }],
          sessions: [{ deviceId: 'device-b' }],
        }),
      },
      providerDevice: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.getProviderDetail('provider-1');

    expect(prisma.providerDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { lastSeenAt: 'desc' },
        take: 8,
        where: expect.objectContaining({
          deviceId: { in: ['device-a', 'device-b'] },
          providerProfileId: { not: 'provider-1' },
        }),
      }),
    );
  });

  it('keeps payment detail callback and audit payloads bounded', async () => {
    const payment = {
      id: 'payment-1',
      bookingId: 'booking-1',
      providerRef: 'momo-ref-1',
    };
    const prisma = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(payment),
      },
      paymentCallbackAttempt: {
        findMany: vi.fn().mockResolvedValue([{ id: 'callback-1' }]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([{ id: 'audit-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getPaymentDetail('payment-1')).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [{ id: 'audit-1' }],
        callbackAttempts: [{ id: 'callback-1' }],
      }),
    );

    expect(prisma.paymentCallbackAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 25,
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ paymentId: 'payment-1' }, { providerRef: 'momo-ref-1' }]),
        }),
      }),
    );
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ target: 'payment:payment-1' }, { target: 'booking:booking-1' }]),
        }),
      }),
    );
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
        findUnique: vi.fn().mockResolvedValue(payment),
      },
      paymentCallbackAttempt: {
        findMany: vi.fn().mockReturnValue(callbackAttempts.promise),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
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

  it('filters payment operations server-side and clamps requested limits', async () => {
    const prisma = {
      payment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPayments({
        range: 'today',
        review: 'capture',
        skip: '20',
        take: '999',
      }),
    ).resolves.toEqual([]);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          booking: expect.objectContaining({
            status: BookingStatus.COMPLETED,
          }),
          status: PaymentStatus.AUTHORIZED,
        }),
        skip: 20,
        take: 100,
      }),
    );
    expect(prisma.payment.findMany.mock.calls[0][0].where.booking).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date) }) }),
        ]),
      }),
    );
  });

  it('counts payment operation summaries without loading payment rows', async () => {
    const prisma = {
      payment: {
        count: vi
          .fn()
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(7),
      },
      paymentCallbackAttempt: {
        count: vi.fn().mockResolvedValueOnce(9).mockResolvedValueOnce(10),
      },
      refund: {
        count: vi.fn().mockResolvedValue(8),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.paymentSummary({
        range: '7d',
        review: 'cash-debt',
      }),
    ).resolves.toEqual({
      authorized: 2,
      callbackReview: 9,
      callbackVerified: 10,
      captured: 5,
      cashDebt: 4,
      linkedRefunds: 8,
      needsAction: 7,
      pendingCash: 3,
      refunded: 6,
      totalCount: 20,
    });

    expect(prisma.payment.count).toHaveBeenCalledTimes(7);
    expect(prisma.paymentCallbackAttempt.count).toHaveBeenCalledTimes(2);
    expect(prisma.refund.count).toHaveBeenCalledWith({
      where: {
        payment: {
          is: expect.objectContaining({
            booking: expect.any(Object),
          }),
        },
      },
    });
    expect(prisma.payment.findMany).toBeUndefined();
  });

  it('filters payment callback attempts server-side and clamps requested limits', async () => {
    const prisma = {
      paymentCallbackAttempt: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPaymentCallbackAttempts({
        range: '7d',
        review: 'callback-review',
        take: '500',
      }),
    ).resolves.toEqual([]);

    expect(prisma.paymentCallbackAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            expect.objectContaining({
              createdAt: expect.objectContaining({ gte: expect.any(Date) }),
            }),
            expect.objectContaining({
              OR: expect.any(Array),
            }),
          ]),
        },
        take: 100,
      }),
    );
  });

  it('filters refunds server-side and clamps requested limits', async () => {
    const prisma = {
      refund: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listRefunds({
        range: 'today',
        review: 'needs-update',
        skip: '20',
        take: '500',
      }),
    ).resolves.toEqual([]);

    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
          payment: expect.objectContaining({
            status: { not: PaymentStatus.REFUNDED },
          }),
          status: 'REQUESTED',
        }),
        skip: 20,
        take: 100,
      }),
    );
  });

  it('summarizes refund operations with server count queries instead of list rows', async () => {
    const prisma = {
      refund: {
        count: vi
          .fn()
          .mockResolvedValueOnce(24)
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(4),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.refundSummary({ range: 'today' })).resolves.toEqual({
      totalCount: 24,
      requestedCount: 8,
      refundedBookingCount: 3,
      needsUpdateCount: 5,
      completedCount: 6,
      openCount: 10,
      outcomeLinkedCount: 4,
    });

    expect(prisma.refund.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
    expect(prisma.refund.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { status: 'REQUESTED' },
          ]),
        }),
      }),
    );
    expect(prisma.refund.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            {
              payment: {
                status: { not: PaymentStatus.REFUNDED },
              },
              status: 'REQUESTED',
            },
          ]),
        }),
      }),
    );
  });

  it('delegates bounded earning list filters to the earnings service', async () => {
    const earnings = {
      listForAdmin: vi.fn().mockResolvedValue([{ id: 'earning-1' }]),
    };
    const service = createAdminService({}, { earnings });

    await expect(
      service.listEarnings({
        range: '7d',
        review: 'ready',
        skip: '150',
        take: '75',
      }),
    ).resolves.toEqual([{ id: 'earning-1' }]);

    expect(earnings.listForAdmin).toHaveBeenCalledWith({
      range: '7d',
      review: 'ready',
      skip: '150',
      take: '75',
    });
  });

  it('delegates earning summary filters to the earnings service', async () => {
    const earnings = {
      adminSummary: vi.fn().mockResolvedValue({ count: 1, grossAmount: 200000 }),
    };
    const service = createAdminService({}, { earnings });

    await expect(service.earningsSummary({ range: 'today' })).resolves.toEqual({
      count: 1,
      grossAmount: 200000,
    });

    expect(earnings.adminSummary).toHaveBeenCalledWith({ range: 'today' });
  });

  it('delegates partner bank deposit approvals to the earnings service with actor id', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const earnings = {
      recordPartnerBankDeposit: vi.fn().mockResolvedValue({
        id: 'wallet-deposit-1',
        providerProfileId: 'provider-1',
        amount: 1000000,
        currency: 'VND',
        reference: 'BIDV-20260629-001',
        sourceKey: 'partner-bank-deposit:provider-1:BIDV-20260629-001',
      }),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.recordPartnerBankDeposit('admin-user-1', {
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'wallet-deposit-1',
        providerProfileId: 'provider-1',
        amount: 1000000,
      }),
    );

    expect(earnings.recordPartnerBankDeposit).toHaveBeenCalledWith({
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: '2026-06-29T09:30:00.000Z',
      attachmentFileId: 'file-deposit-proof-1',
      adminId: 'admin-user-1',
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'provider_wallet.bank_deposit_received',
        target: 'provider_wallet_ledger:wallet-deposit-1',
      }),
    });
  });

  it('previews customer manual promotion credits without creating revenue or bank movement', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 25000 } }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.previewManualWalletAdjustment('admin-user-1', {
        ownerType: 'CUSTOMER',
        ownerId: 'customer-1',
        direction: 'CREDIT',
        adjustmentType: 'PROMOTION_CREDIT',
        amount: 100000,
        reason: ' Welcome credit ',
      }),
    ).resolves.toMatchObject({
      ownerId: 'customer-1',
      ownerType: 'CUSTOMER',
      beforeBalance: 25000,
      afterBalance: 125000,
      bankCashAmount: 0,
      companyOutputVat: 0,
      platformRevenueAmount: 0,
      affects: {
        bankCash: false,
        revenue: false,
        taxPayable: false,
      },
    });

    expect(prisma.customerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { customerProfileId: 'customer-1', currency: 'VND' },
      _sum: { amount: true },
    });
  });

  it('creates partner manual bonus credits as wallet ledger plus admin audit without touching bank cash', async () => {
    const tx = {
      providerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn().mockResolvedValue({
          id: 'ledger-1',
          providerProfileId: 'provider-1',
          amount: 200000,
          currency: 'VND',
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustment('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        reason: 'Excellent customer recovery',
        approvalId: 'approval-1',
      }),
    ).resolves.toMatchObject({
      ledger: { id: 'ledger-1', amount: 200000 },
      preview: {
        walletDelta: 200000,
        bankCashAmount: 0,
        companyOutputVat: 0,
        platformRevenueAmount: 0,
      },
      auditLog: { id: 'audit-1' },
    });

    expect(tx.providerWalletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerProfileId: 'provider-1',
        type: 'MANUAL_ADJUSTMENT_CREDIT',
        sourceKey: 'manual-wallet-adjustment:PARTNER:provider-1:approval-1',
        amount: 200000,
        currency: 'VND',
        reference: 'approval-1',
        metadata: expect.objectContaining({
          bankCashAmount: 0,
          companyOutputVat: 0,
          platformRevenueAmount: 0,
        }),
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'wallet_ledger.manual_adjustment.create',
        target: 'provider_wallet_ledger:ledger-1',
      }),
    });
  });

  it('lists recent manual wallet adjustments across customer and partner ledgers without loading all rows', async () => {
    const prisma = {
      customerWalletLedgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'customer-ledger-1',
            customerProfileId: 'customer-1',
            type: CustomerWalletLedgerType.ADMIN_ADJUSTMENT,
            sourceKey: 'manual-wallet-adjustment:CUSTOMER:customer-1:approval-customer-1',
            amount: 100000,
            currency: 'VND',
            reference: 'approval-customer-1',
            notes: 'Welcome credit',
            createdAt: new Date('2026-06-28T10:00:00.000Z'),
            metadata: {
              manualWalletAdjustment: true,
              ownerType: 'CUSTOMER',
              direction: 'CREDIT',
              adjustmentType: 'PROMOTION_CREDIT',
              beforeBalance: 0,
              afterBalance: 100000,
              approvalId: 'approval-customer-1',
              affects: { walletLiability: true, revenue: false },
            },
            customerProfile: {
              user: { fullName: 'Demo Customer', phone: '+84111111111' },
            },
          },
        ]),
      },
      providerWalletLedgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'provider-ledger-1',
            providerProfileId: 'provider-1',
            type: ProviderWalletLedgerType.MANUAL_ADJUSTMENT_CREDIT,
            sourceKey: 'manual-wallet-adjustment:PARTNER:provider-1:approval-partner-1',
            amount: 200000,
            currency: 'VND',
            reference: 'approval-partner-1',
            notes: 'Launch bonus',
            createdAt: new Date('2026-06-29T09:00:00.000Z'),
            metadata: {
              manualWalletAdjustment: true,
              ownerType: 'PARTNER',
              direction: 'CREDIT',
              adjustmentType: 'PARTNER_BONUS',
              beforeBalance: 0,
              afterBalance: 200000,
              approvalId: 'approval-partner-1',
              affects: { walletLiability: true, revenue: false },
            },
            providerProfile: {
              displayName: 'Smoke Partner',
              user: { fullName: 'Smoke Partner Legal', phone: '+84222222222' },
            },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listManualWalletAdjustments({ skip: '1', take: '1' })).resolves.toEqual([
      expect.objectContaining({
        id: 'customer-ledger-1',
        ownerLabel: 'Demo Customer',
        ownerType: 'CUSTOMER',
        direction: 'CREDIT',
        adjustmentType: 'PROMOTION_CREDIT',
        amount: 100000,
        beforeBalance: 0,
        afterBalance: 100000,
      }),
    ]);

    expect(prisma.customerWalletLedgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: { createdAt: 'desc' },
        where: expect.objectContaining({
          type: CustomerWalletLedgerType.ADMIN_ADJUSTMENT,
        }),
      }),
    );
    expect(prisma.providerWalletLedgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: { createdAt: 'desc' },
        where: expect.objectContaining({
          type: {
            in: [
              ProviderWalletLedgerType.MANUAL_ADJUSTMENT_CREDIT,
              ProviderWalletLedgerType.MANUAL_ADJUSTMENT_DEBIT,
              ProviderWalletLedgerType.MANUAL_ADJUSTMENT_REVERSAL,
            ],
          },
        }),
      }),
    );
  });

  it('summarizes manual wallet adjustment history with count queries only', async () => {
    const prisma = {
      customerWalletLedgerEntry: {
        count: vi.fn().mockResolvedValue(4),
        findMany: vi.fn(),
      },
      providerWalletLedgerEntry: {
        count: vi.fn().mockResolvedValue(8),
        findMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.manualWalletAdjustmentSummary({ ownerType: 'PARTNER', ownerId: 'provider-1' })).resolves.toEqual({
      total: 8,
    });
    await expect(service.manualWalletAdjustmentSummary({ ownerType: 'CUSTOMER', ownerId: 'customer-1' })).resolves.toEqual({
      total: 4,
    });
    await expect(service.manualWalletAdjustmentSummary()).resolves.toEqual({
      total: 12,
    });

    expect(prisma.customerWalletLedgerEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.providerWalletLedgerEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.providerWalletLedgerEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerProfileId: 'provider-1' }),
      }),
    );
    expect(prisma.customerWalletLedgerEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerProfileId: 'customer-1' }),
      }),
    );
  });

  it('rejects high-value manual adjustments without an attachment before writing a ledger', async () => {
    const tx = {
      providerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn().mockResolvedValue({
          id: 'ledger-invalid-url',
          providerProfileId: 'provider-1',
          amount: 10000000,
          currency: 'VND',
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-invalid-url' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustment('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 10000000,
        reason: 'High-value correction',
        approvalId: 'approval-high',
      }),
    ).rejects.toThrow('Attachment is required for this manual wallet adjustment');

    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects invalid manual wallet adjustment attachment URLs before writing a ledger', async () => {
    const tx = {
      providerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn().mockResolvedValue({
          id: 'ledger-invalid-url',
          providerProfileId: 'provider-1',
          amount: 10000000,
          currency: 'VND',
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-invalid-url' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustment('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 10000000,
        reason: 'High-value correction with invalid evidence URL',
        approvalId: 'approval-high',
        attachmentUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('Attachment URL must use http or https');

    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects manual wallet adjustments for unknown owners before writing a ledger', async () => {
    const tx = {
      providerProfile: {
        findUniqueOrThrow: vi.fn().mockRejectedValue(new Error('Record not found')),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustment('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'missing-provider',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 100000,
        reason: 'Missing owner should not write ledger',
        approvalId: 'approval-missing-owner',
      }),
    ).rejects.toThrow('Manual wallet adjustment owner was not found');

    expect(tx.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects direct manual adjustments against a closed monthly period', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      monthlyTaxClosing: {
        findFirst: vi.fn().mockResolvedValue({ status: MonthlyTaxClosingStatus.CLOSED }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.previewManualWalletAdjustment('admin-user-1', {
        ownerType: 'CUSTOMER',
        ownerId: 'customer-1',
        direction: 'CREDIT',
        adjustmentType: 'PROMOTION_CREDIT',
        amount: 50000,
        reason: 'Closed period correction',
        monthlyPeriod: '2026-06',
      }),
    ).rejects.toThrow('Closed monthly periods require a reversal entry instead of direct edit');
  });

  it('rejects impossible manual wallet adjustment monthly periods before DB reads', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      monthlyTaxClosing: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.previewManualWalletAdjustment('admin-user-1', {
        ownerType: 'CUSTOMER',
        ownerId: 'customer-1',
        direction: 'CREDIT',
        adjustmentType: 'PROMOTION_CREDIT',
        amount: 50000,
        reason: 'Impossible monthly period',
        monthlyPeriod: '2026-13',
      }),
    ).rejects.toThrow('Monthly period must use YYYY-MM with month 01-12');

    expect(prisma.customerProfile.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prisma.customerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(prisma.monthlyTaxClosing.findFirst).not.toHaveBeenCalled();
  });

  it('delegates partner wallet withdrawal request updates to the earnings service with audit', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const earnings = {
      updateProviderWalletWithdrawalRequestForAdmin: vi.fn().mockResolvedValue({
        id: 'withdrawal-request-1',
        providerProfileId: 'provider-1',
        amount: 500000,
        currency: 'VND',
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
        metadata: {
          lastStatusChange: {
            previousStatus: 'BANK_TRANSFER_PENDING',
            nextStatus: 'PAID',
            lockedAmountReleased: false,
            lockedAmountRetained: false,
          },
        },
      }),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.updateProviderWalletWithdrawalRequest('admin-user-1', 'withdrawal-request-1', {
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
        bankTransferDate: '2026-06-29T09:30:00.000Z',
        attachmentUrl: 'https://storage.example/payouts/proof.jpg',
        adminNote: 'Manual bank transfer confirmed',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'withdrawal-request-1',
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
      }),
    );

    expect(earnings.updateProviderWalletWithdrawalRequestForAdmin).toHaveBeenCalledWith(
      'withdrawal-request-1',
      {
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
        bankTransferDate: '2026-06-29T09:30:00.000Z',
        attachmentUrl: 'https://storage.example/payouts/proof.jpg',
        adminNote: 'Manual bank transfer confirmed',
      },
      'admin-user-1',
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'provider_wallet.withdrawal_request.update',
        target: 'provider_wallet_withdrawal_request:withdrawal-request-1',
        metadata: expect.objectContaining({
          status: 'PAID',
          previousStatus: 'BANK_TRANSFER_PENDING',
          withdrawalStatusChange: expect.objectContaining({
            previousStatus: 'BANK_TRANSFER_PENDING',
            nextStatus: 'PAID',
          }),
        }),
      }),
    });
  });

  it('lists booking settlement snapshots with bounded range and review filters', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        findMany: vi.fn().mockResolvedValue([{ id: 'settlement-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listBookingSettlementSnapshots({
        range: '7d',
        review: 'open',
        skip: '50',
        take: '75',
      }),
    ).resolves.toEqual([{ id: 'settlement-1' }]);

    expect(prisma.bookingSettlementSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { postedAt: 'desc' },
        skip: 50,
        take: 75,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ postedAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { taxStatus: BookingSettlementTaxStatus.OPEN },
          ]),
        }),
      }),
    );
  });

  it('summarizes booking settlement snapshots from snapshot aggregates only', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: {
            customerPaymentAmount: 600000,
            partnerPayoutAmount: 430000,
            partnerWithholdingTotal: 42000,
            platformFeeGross: 128000,
            platformFeeNetRevenue: 118519,
            companyOutputVat: 9481,
            paymentProcessingFee: 10000,
          },
        }),
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.bookingSettlementSnapshotSummary({ range: '30d', review: 'posted' })).resolves.toEqual({
      count: 1,
      currency: 'VND',
      customerPaymentAmount: 600000,
      partnerPayoutAmount: 430000,
      partnerWithholdingTotal: 42000,
      platformFeeGross: 128000,
      platformFeeNetRevenue: 118519,
      companyOutputVat: 9481,
      paymentProcessingFee: 10000,
      openTaxCount: 0,
      paidTaxCount: 1,
    });

    expect(prisma.bookingSettlementSnapshot.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: expect.objectContaining({
          partnerWithholdingTotal: true,
          companyOutputVat: true,
          paymentProcessingFee: true,
        }),
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ postedAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { settlementStatus: BookingSettlementStatus.POSTED },
          ]),
        }),
      }),
    );
  });

  it('lists booking settlement reversal entries with bounded occurred-at filters', async () => {
    const prisma = {
      bookingSettlementReversalEntry: {
        findMany: vi.fn().mockResolvedValue([{ id: 'reversal-1' }]),
      },
    };
    const service = createAdminService(prisma) as AdminService & {
      listBookingSettlementReversals: AdminService['listBookingSettlementSnapshots'];
    };

    await expect(
      service.listBookingSettlementReversals({
        range: '7d',
        review: 'cash',
        skip: '25',
        take: '50',
      }),
    ).resolves.toEqual([{ id: 'reversal-1' }]);

    expect(prisma.bookingSettlementReversalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { occurredAt: 'desc' },
        select: expect.objectContaining({
          accountingJournalBatches: expect.objectContaining({
            select: expect.objectContaining({ id: true, sourceKey: true, status: true }),
            take: 1,
          }),
          paymentClearingEntries: expect.objectContaining({
            select: expect.objectContaining({ id: true, sourceKey: true, status: true }),
            take: 1,
          }),
        }),
        skip: 25,
        take: 50,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ occurredAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { paymentMethod: PaymentMethod.CASH },
          ]),
        }),
      }),
    );
  });

  it('summarizes booking settlement reversal entries from reversal aggregates only', async () => {
    const prisma = {
      bookingSettlementReversalEntry: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: {
            customerPaymentAmount: -600000,
            partnerPayoutAmount: -430000,
            partnerWithholdingTotal: -42000,
            platformFeeGross: -128000,
            platformFeeNetRevenue: -118519,
            companyOutputVat: -9481,
            paymentProcessingFee: -10000,
          },
        }),
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1),
      },
    };
    const service = createAdminService(prisma) as AdminService & {
      bookingSettlementReversalSummary: AdminService['bookingSettlementSnapshotSummary'];
    };

    await expect(service.bookingSettlementReversalSummary({ range: '30d', review: 'non-cash' })).resolves.toEqual({
      count: 1,
      currency: 'VND',
      customerPaymentAmount: -600000,
      partnerPayoutAmount: -430000,
      partnerWithholdingTotal: -42000,
      platformFeeGross: -128000,
      platformFeeNetRevenue: -118519,
      companyOutputVat: -9481,
      paymentProcessingFee: -10000,
      cashCount: 0,
      nonCashCount: 1,
    });

    expect(prisma.bookingSettlementReversalEntry.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: expect.objectContaining({
          partnerWithholdingTotal: true,
          companyOutputVat: true,
          paymentProcessingFee: true,
        }),
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ occurredAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { paymentMethod: { not: PaymentMethod.CASH } },
          ]),
        }),
      }),
    );
  });

  it('lists accounting journal batches with bounded posted-at filters and entry counts only', async () => {
    const prisma = {
      accountingJournalBatch: {
        findMany: vi.fn().mockResolvedValue([{ id: 'journal-batch-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listAccountingJournalBatches({
        range: '7d',
        review: 'posted',
        skip: '50',
        take: '75',
      }),
    ).resolves.toEqual([{ id: 'journal-batch-1' }]);

    expect(prisma.accountingJournalBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { postedAt: 'desc' },
        select: expect.objectContaining({
          _count: { select: { entries: true } },
        }),
        skip: 50,
        take: 75,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ postedAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { status: AccountingJournalBatchStatus.POSTED },
          ]),
        }),
      }),
    );
  });

  it('summarizes accounting journal batches from journal aggregates only', async () => {
    const prisma = {
      accountingJournalBatch: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { totalCredit: 500000, totalDebit: 500000 },
        }),
        count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(2).mockResolvedValueOnce(0),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.accountingJournalBatchSummary({ range: '30d', review: 'posted' })).resolves.toEqual({
      count: 2,
      currency: 'VND',
      postedCount: 2,
      reversedCount: 0,
      totalCredit: 500000,
      totalDebit: 500000,
    });

    expect(prisma.accountingJournalBatch.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { totalCredit: true, totalDebit: true },
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ postedAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { status: AccountingJournalBatchStatus.POSTED },
          ]),
        }),
      }),
    );
  });

  it('loads accounting journal batch detail with entry evidence only when requested', async () => {
    const prisma = {
      accountingJournalBatch: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'journal-batch-1',
          entries: [{ id: 'journal-entry-1', accountCode: '4110' }],
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.accountingJournalBatchDetail('journal-batch-1')).resolves.toEqual({
      id: 'journal-batch-1',
      entries: [{ id: 'journal-entry-1', accountCode: '4110' }],
    });

    expect(prisma.accountingJournalBatch.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'journal-batch-1' },
        select: expect.objectContaining({
          entries: expect.objectContaining({
            orderBy: { createdAt: 'asc' },
            select: expect.objectContaining({
              accountCode: true,
              accountName: true,
              amount: true,
              side: true,
            }),
          }),
        }),
      }),
    );
  });

  it('lists booking payment clearing entries with bounded occurrence filters', async () => {
    const prisma = {
      bookingPaymentClearingEntry: {
        findMany: vi.fn().mockResolvedValue([{ id: 'clearing-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listBookingPaymentClearingEntries({
        range: 'today',
        review: 'open',
        skip: '25',
        take: '125',
      }),
    ).resolves.toEqual([{ id: 'clearing-1' }]);

    expect(prisma.bookingPaymentClearingEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { occurredAt: 'desc' },
        select: expect.objectContaining({ booking: expect.any(Object), payment: expect.any(Object) }),
        skip: 25,
        take: 100,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ occurredAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { status: BookingPaymentClearingStatus.OPEN },
          ]),
        }),
      }),
    );
  });

  it('summarizes booking payment clearing without loading booking rows', async () => {
    const prisma = {
      bookingPaymentClearingEntry: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { amount: 900000 },
        }),
        count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.bookingPaymentClearingSummary({ range: '30d', review: 'open' })).resolves.toEqual({
      amount: 900000,
      clearedCount: 2,
      count: 3,
      currency: 'VND',
      openCount: 1,
    });

    expect(prisma.bookingPaymentClearingEntry.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { amount: true },
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ occurredAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { status: BookingPaymentClearingStatus.OPEN },
          ]),
        }),
      }),
    );
  });

  it('loads booking payment clearing detail with reconciliation matches only when requested', async () => {
    const prisma = {
      bookingPaymentClearingEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'clearing-1',
          bankReconciliationMatches: [{ id: 'match-1', amount: 900000 }],
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.bookingPaymentClearingEntryDetail('clearing-1')).resolves.toEqual({
      id: 'clearing-1',
      bankReconciliationMatches: [{ id: 'match-1', amount: 900000 }],
    });

    expect(prisma.bookingPaymentClearingEntry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'clearing-1' },
        select: expect.objectContaining({
          bankReconciliationMatches: expect.objectContaining({
            orderBy: { matchedAt: 'desc' },
            select: expect.objectContaining({
              accountingJournalEntry: expect.objectContaining({
                select: expect.objectContaining({
                  batchId: true,
                  accountCode: true,
                  accountName: true,
                }),
              }),
              amount: true,
              bankTransaction: expect.any(Object),
              status: true,
            }),
          }),
        }),
      }),
    );
  });

  it('lists bank reconciliation transactions with bounded occurrence filters and match counts only', async () => {
    const prisma = {
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([{ id: 'bank-tx-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listBankReconciliationTransactions({
        range: '7d',
        review: 'unmatched',
        skip: '50',
        take: '75',
      }),
    ).resolves.toEqual([{ id: 'bank-tx-1' }]);

    expect(prisma.companyBankTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { occurredAt: 'desc' },
        select: expect.objectContaining({
          _count: { select: { reconciliationMatches: true } },
        }),
        skip: 50,
        take: 75,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ occurredAt: expect.objectContaining({ gte: expect.any(Date) }) }),
            { status: BankReconciliationStatus.UNMATCHED },
          ]),
        }),
      }),
    );
  });

  it('summarizes bank reconciliation transactions without loading transaction rows', async () => {
    const prisma = {
      companyBankTransaction: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { amount: 1200000 },
        }),
        count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1).mockResolvedValueOnce(3),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.bankReconciliationSummary({ range: 'all', review: 'matched' })).resolves.toEqual({
      amount: 1200000,
      count: 4,
      currency: 'VND',
      matchedCount: 3,
      unmatchedCount: 1,
    });

    expect(prisma.companyBankTransaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { amount: true },
        where: { status: BankReconciliationStatus.MATCHED },
      }),
    );
  });

  it('loads bank reconciliation transaction detail with matched accounting evidence only when requested', async () => {
    const prisma = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          reconciliationMatches: [{ id: 'match-1', amount: 900000 }],
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.bankReconciliationTransactionDetail('bank-tx-1')).resolves.toEqual({
      id: 'bank-tx-1',
      reconciliationMatches: [{ id: 'match-1', amount: 900000 }],
    });

    expect(prisma.companyBankTransaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bank-tx-1' },
        select: expect.objectContaining({
          reconciliationMatches: expect.objectContaining({
            orderBy: { matchedAt: 'desc' },
            select: expect.objectContaining({
              accountingJournalEntry: expect.any(Object),
              amount: true,
              paymentClearingEntry: expect.any(Object),
              status: true,
            }),
          }),
        }),
      }),
    );
  });

  it('creates a manual bank reconciliation match and closes matching clearing evidence in one transaction', async () => {
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 900000,
          currency: 'VND',
          status: BankReconciliationStatus.UNMATCHED,
        }),
        update: vi.fn().mockResolvedValue({ id: 'bank-tx-1', status: BankReconciliationStatus.MATCHED }),
      },
      bookingPaymentClearingEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'clearing-1',
          amount: 900000,
          currency: 'VND',
          status: BookingPaymentClearingStatus.OPEN,
        }),
        update: vi.fn().mockResolvedValue({ id: 'clearing-1', status: BookingPaymentClearingStatus.CLEARED }),
      },
      bankReconciliationMatch: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValue({ _sum: { amount: 900000 } }),
        create: vi.fn().mockResolvedValue({
          id: 'match-1',
          bankTransactionId: 'bank-tx-1',
          paymentClearingEntryId: 'clearing-1',
          amount: 900000,
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        amount: 900000,
        notes: 'Matched to VCB transfer',
      }),
    ).resolves.toMatchObject({
      match: { id: 'match-1', bankTransactionId: 'bank-tx-1' },
      bankTransaction: { id: 'bank-tx-1', status: BankReconciliationStatus.MATCHED },
    });

    expect(tx.bankReconciliationMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bankTransactionId: 'bank-tx-1',
        paymentClearingEntryId: 'clearing-1',
        amount: 900000,
        currency: 'VND',
        matchedByAdminId: 'admin-user-1',
        sourceKey: 'bank-reconciliation-match:bank-tx-1:payment-clearing:clearing-1',
        notes: 'Matched to VCB transfer',
      }),
    });
    expect(tx.companyBankTransaction.update).toHaveBeenCalledWith({
      where: { id: 'bank-tx-1' },
      data: { status: BankReconciliationStatus.MATCHED },
      select: expect.any(Object),
    });
    expect(tx.bookingPaymentClearingEntry.update).toHaveBeenCalledWith({
      where: { id: 'clearing-1' },
      data: { status: BookingPaymentClearingStatus.CLEARED, clearedAt: expect.any(Date) },
      select: expect.any(Object),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'bank_reconciliation.match.create',
        target: 'bank_transaction:bank-tx-1',
        metadata: expect.objectContaining({
          paymentClearingEntryId: 'clearing-1',
          amount: 900000,
          bankStatusBefore: BankReconciliationStatus.UNMATCHED,
          bankStatusAfter: BankReconciliationStatus.MATCHED,
          currency: 'VND',
          paymentClearingStatusBefore: BookingPaymentClearingStatus.OPEN,
          paymentClearingStatusAfter: BookingPaymentClearingStatus.CLEARED,
        }),
      }),
    });
  });

  it('rejects manual bank reconciliation matches that exceed the remaining bank transaction amount', async () => {
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 900000,
          currency: 'VND',
          status: BankReconciliationStatus.PARTIALLY_MATCHED,
        }),
        update: vi.fn(),
      },
      bookingPaymentClearingEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'clearing-1',
          amount: 300000,
          currency: 'VND',
          status: BookingPaymentClearingStatus.OPEN,
        }),
        update: vi.fn(),
      },
      bankReconciliationMatch: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 800000 } }),
        create: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        amount: 300000,
        notes: 'Would overmatch the bank transaction',
      }),
    ).rejects.toThrow('Match amount exceeds remaining bank transaction amount');

    expect(tx.bankReconciliationMatch.create).not.toHaveBeenCalled();
    expect(tx.companyBankTransaction.update).not.toHaveBeenCalled();
    expect(tx.bookingPaymentClearingEntry.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects manual bank reconciliation matches that exceed the remaining reconciliation source amount', async () => {
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 900000,
          currency: 'VND',
          status: BankReconciliationStatus.PARTIALLY_MATCHED,
        }),
        update: vi.fn(),
      },
      bookingPaymentClearingEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'clearing-1',
          amount: 900000,
          currency: 'VND',
          status: BookingPaymentClearingStatus.PARTIALLY_CLEARED,
        }),
        update: vi.fn(),
      },
      bankReconciliationMatch: {
        aggregate: vi.fn().mockResolvedValueOnce({ _sum: { amount: 800000 } }),
        create: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        amount: 300000,
        notes: 'Would overmatch the clearing source',
      }),
    ).rejects.toThrow('Match amount exceeds remaining reconciliation source amount');

    expect(tx.bankReconciliationMatch.create).not.toHaveBeenCalled();
    expect(tx.companyBankTransaction.update).not.toHaveBeenCalled();
    expect(tx.bookingPaymentClearingEntry.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('reverses a bank reconciliation match and recalculates linked statuses in one transaction', async () => {
    const tx = {
      bankReconciliationMatch: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'match-1',
          bankTransactionId: 'bank-tx-1',
          paymentClearingEntryId: 'clearing-1',
          status: BankReconciliationStatus.MATCHED,
          amount: 500000,
          currency: 'VND',
          bankTransaction: {
            amount: 900000,
            currency: 'VND',
            status: BankReconciliationStatus.MATCHED,
          },
        }),
        update: vi.fn().mockResolvedValue({
          id: 'match-1',
          status: BankReconciliationStatus.REVERSED,
        }),
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 400000 } })
          .mockResolvedValueOnce({ _sum: { amount: 400000 } }),
      },
      companyBankTransaction: {
        update: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          status: BankReconciliationStatus.PARTIALLY_MATCHED,
        }),
      },
      bookingPaymentClearingEntry: {
        findUnique: vi.fn().mockResolvedValue({
          amount: 900000,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'clearing-1',
          status: BookingPaymentClearingStatus.PARTIALLY_CLEARED,
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-reverse-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.reverseBankReconciliationMatch('admin-user-1', 'bank-tx-1', 'match-1', {
        reason: 'Wrong payment clearing source',
      }),
    ).resolves.toMatchObject({
      match: { id: 'match-1', status: BankReconciliationStatus.REVERSED },
      bankTransaction: { id: 'bank-tx-1', status: BankReconciliationStatus.PARTIALLY_MATCHED },
      paymentClearingEntry: { id: 'clearing-1', status: BookingPaymentClearingStatus.PARTIALLY_CLEARED },
    });

    expect(tx.bankReconciliationMatch.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        status: BankReconciliationStatus.REVERSED,
        notes: 'Wrong payment clearing source',
      }),
    });
    expect(tx.companyBankTransaction.update).toHaveBeenCalledWith({
      where: { id: 'bank-tx-1' },
      data: { status: BankReconciliationStatus.PARTIALLY_MATCHED },
      select: expect.any(Object),
    });
    expect(tx.bookingPaymentClearingEntry.update).toHaveBeenCalledWith({
      where: { id: 'clearing-1' },
      data: { status: BookingPaymentClearingStatus.PARTIALLY_CLEARED, clearedAt: null },
      select: expect.any(Object),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'bank_reconciliation.match.reverse',
        target: 'bank_reconciliation_match:match-1',
        metadata: expect.objectContaining({
          bankTransactionId: 'bank-tx-1',
          bankStatusBefore: BankReconciliationStatus.MATCHED,
          bankStatusAfter: BankReconciliationStatus.PARTIALLY_MATCHED,
          paymentClearingEntryId: 'clearing-1',
          paymentClearingStatusAfter: BookingPaymentClearingStatus.PARTIALLY_CLEARED,
          reason: 'Wrong payment clearing source',
        }),
      }),
    });
  });

  it('rejects manual bank reconciliation matches with more than one source record', async () => {
    const service = createAdminService({});

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        payoutBatchId: 'payout-1',
        amount: 900000,
      }),
    ).rejects.toThrow('Select exactly one reconciliation source');
  });

  it('summarizes coupon finance from settlement snapshot metadata without loading booking rows', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          bookingServiceAmount: 600_000n,
          companyCouponExpense: 60_000n,
          couponDiscountAmount: 60_000n,
          couponReviewFlagCount: 0n,
          couponSettlementCount: 1n,
          customerPaidAmount: 540_000n,
          partnerFundedCouponAmount: 0n,
          platformFeeDiscountAmount: 0n,
          reversedCompanyCouponExpense: 0n,
          reversedCouponDiscountAmount: 0n,
          settlementBaseAmount: 600_000n,
        },
      ]),
      bookingSettlementSnapshot: {
        findMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.couponFinanceSummary({ range: '7d', review: 'posted' })).resolves.toEqual({
      bookingServiceAmount: 600_000,
      companyCouponExpense: 60_000,
      couponDiscountAmount: 60_000,
      couponReviewFlagCount: 0,
      couponSettlementCount: 1,
      currency: 'VND',
      customerPaidAmount: 540_000,
      partnerFundedCouponAmount: 0,
      platformFeeDiscountAmount: 0,
      reversedCompanyCouponExpense: 0,
      reversedCouponDiscountAmount: 0,
      settlementBaseAmount: 600_000,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.bookingSettlementSnapshot.findMany).not.toHaveBeenCalled();
  });

  it('lists coupon finance settlement rows by bounded coupon metadata ids', async () => {
    const settlementRow = {
      id: 'settlement-1',
      postedAt: new Date('2026-06-13T03:02:00.000Z'),
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'settlement-1' }]),
      bookingSettlementSnapshot: {
        findMany: vi.fn().mockResolvedValue([settlementRow]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listCouponFinanceSnapshots({ range: '7d', review: 'posted', skip: '50', take: '25' }),
    ).resolves.toEqual([settlementRow]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.bookingSettlementSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['settlement-1'] } },
        select: expect.objectContaining({ metadata: true }),
      }),
    );
  });

  it('groups partner withholding tax by monthly period and provider', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'provider-1',
            monthlyPeriod: '2026-06',
            currency: 'VND',
            _count: { _all: 2 },
            _sum: {
              customerPaymentAmount: 1200000,
              partnerPayoutAmount: 860000,
              partnerVatAmount: 60000,
              partnerPitAmount: 24000,
              partnerWithholdingTotal: 84000,
            },
          },
        ]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'provider-1',
            displayName: 'Smoke Partner',
            user: { fullName: 'Smoke Partner User', phone: '+84900000000' },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listPartnerWithholdingTax({ period: '2026-06', skip: '50', take: '25' })).resolves.toEqual([
      {
        providerProfileId: 'provider-1',
        partnerName: 'Smoke Partner',
        partnerPhone: '+84900000000',
        period: '2026-06',
        currency: 'VND',
        completedBookingCount: 2,
        grossServiceRevenue: 1200000,
        partnerPayoutTotal: 860000,
        partnerVatWithheldTotal: 60000,
        partnerPitWithheldTotal: 24000,
        totalPartnerTaxWithheld: 84000,
      },
    ]);

    expect(prisma.bookingSettlementSnapshot.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['providerProfileId', 'monthlyPeriod', 'currency'],
        orderBy: [{ monthlyPeriod: 'desc' }, { providerProfileId: 'asc' }],
        skip: 50,
        take: 25,
        where: expect.objectContaining({
          monthlyPeriod: '2026-06',
          OR: [{ customerPaymentAmount: { gt: 0 } }, { partnerWithholdingTotal: { gt: 0 } }],
        }),
      }),
    );
  });

  it('summarizes partner withholding tax monthly totals from settlement snapshots', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ partnerCountWithRevenue: 1n }]),
      bookingSettlementSnapshot: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: {
            customerPaymentAmount: 1200000,
            partnerPayoutAmount: 860000,
            partnerVatAmount: 60000,
            partnerPitAmount: 24000,
            partnerWithholdingTotal: 84000,
          },
        }),
        groupBy: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.partnerWithholdingTaxSummary({ period: '2026-06' })).resolves.toEqual({
      period: '2026-06',
      currency: 'VND',
      partnerCountWithRevenue: 1,
      taxableBookingCount: 2,
      grossServiceRevenue: 1200000,
      partnerPayoutTotal: 860000,
      partnerVatWithheldTotal: 60000,
      partnerPitWithheldTotal: 24000,
      totalPartnerTaxWithheld: 84000,
    });

    expect(prisma.bookingSettlementSnapshot.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ monthlyPeriod: '2026-06' }),
      }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.bookingSettlementSnapshot.groupBy).not.toHaveBeenCalled();
  });

  it('lists monthly tax closings with bounded period filters', async () => {
    const prisma = {
      monthlyTaxClosing: {
        findMany: vi.fn().mockResolvedValue([{ period: '2026-06' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listMonthlyTaxClosings({ period: '2026-06', skip: '25', take: '25' })).resolves.toEqual([
      { period: '2026-06' },
    ]);

    expect(prisma.monthlyTaxClosing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { period: 'desc' },
        skip: 25,
        take: 25,
        where: { period: '2026-06' },
      }),
    );
  });

  it('summarizes monthly tax closing preview from settlement snapshots and existing closing status', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ partnerCountWithRevenue: 1n }])
        .mockResolvedValueOnce([
          {
            companyCouponExpense: 60_000n,
            couponDiscountAmount: 60_000n,
            couponReviewFlagCount: 1n,
            couponSettlementCount: 1n,
            partnerFundedCouponAmount: 0n,
            platformFeeDiscountAmount: 0n,
          },
        ]),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: 'REVIEWED',
          declaredAt: null,
          paidAt: null,
          closedAt: null,
          notes: 'Ready for review',
        }),
      },
      bookingSettlementSnapshot: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({
            _count: { _all: 2 },
            _sum: {
              customerPaymentAmount: 1200000,
              partnerPayoutAmount: 860000,
              platformFeeGross: 256000,
              platformFeeNetRevenue: 237038,
              companyOutputVat: 18962,
              partnerVatAmount: 60000,
              partnerPitAmount: 24000,
              partnerWithholdingTotal: 84000,
              paymentProcessingFee: 0,
            },
          })
          .mockResolvedValueOnce({
            _sum: {
              platformFeeGross: 128000,
              partnerWithholdingTotal: 42000,
            },
          })
          .mockResolvedValueOnce({
            _sum: {
              partnerPayoutAmount: 430000,
            },
          }),
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
        groupBy: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.monthlyTaxClosingSummary({ period: '2026-06' })).resolves.toEqual({
      id: 'closing-1',
      period: '2026-06',
      currency: 'VND',
      status: 'REVIEWED',
      settlementCount: 2,
      customerPaymentAmountTotal: 1200000,
      partnerPayoutTotal: 860000,
      platformFeeGrossTotal: 256000,
      platformFeeNetRevenueTotal: 237038,
      companyOutputVatTotal: 18962,
      partnerVatWithheldTotal: 60000,
      partnerPitWithheldTotal: 24000,
      partnerWithholdingTotal: 84000,
      paymentProcessingFeeTotal: 0,
      couponSettlementCount: 1,
      couponDiscountAmountTotal: 60000,
      companyCouponExpenseTotal: 60000,
      partnerFundedCouponAmountTotal: 0,
      platformFeeDiscountAmountTotal: 0,
      couponReviewFlagCount: 1,
      cashDebtTotal: 170000,
      nonCashPartnerPayoutTotal: 430000,
      partnerCountWithRevenue: 1,
      openTaxCount: 1,
      paidTaxCount: 1,
      reconciliationDelta: 0,
      netRevenueDelta: 0,
      declaredAt: null,
      paidAt: null,
      closedAt: null,
      notes: 'Ready for review',
    });

    expect(prisma.bookingSettlementSnapshot.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { monthlyPeriod: '2026-06' },
      }),
    );
    expect(prisma.monthlyTaxClosing.findUnique).toHaveBeenCalledWith({
      where: { period_currency: { period: '2026-06', currency: 'VND' } },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.bookingSettlementSnapshot.groupBy).not.toHaveBeenCalled();
  });

  it('updates monthly tax closing status by snapshotting summary totals and writing audit metadata', async () => {
    const existingClosing = {
      id: 'closing-1',
      period: '2026-06',
      currency: 'VND',
      status: MonthlyTaxClosingStatus.REVIEWED,
      declaredAt: null,
      paidAt: null,
      closedAt: null,
      notes: 'Ready',
    };
    const updatedClosing = {
      ...existingClosing,
      status: MonthlyTaxClosingStatus.DECLARED,
      declaredAt: new Date('2026-06-30T10:00:00.000Z'),
      notes: 'Submitted to tax portal',
    };
    const tx = {
      monthlyTaxClosing: {
        upsert: vi.fn().mockResolvedValue(updatedClosing),
      },
      bookingSettlementSnapshot: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          companyCouponExpense: 60_000n,
          couponDiscountAmount: 60_000n,
          couponReviewFlagCount: 1n,
          couponSettlementCount: 1n,
          partnerFundedCouponAmount: 0n,
          platformFeeDiscountAmount: 0n,
        },
      ]),
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue(existingClosing),
      },
      bookingSettlementSnapshot: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({
            _count: { _all: 2 },
            _sum: {
              customerPaymentAmount: 1200000,
              partnerPayoutAmount: 860000,
              platformFeeGross: 256000,
              platformFeeNetRevenue: 237038,
              companyOutputVat: 18962,
              partnerVatAmount: 60000,
              partnerPitAmount: 24000,
              partnerWithholdingTotal: 84000,
              paymentProcessingFee: 0,
            },
          })
          .mockResolvedValueOnce({
            _sum: {
              platformFeeGross: 128000,
              partnerWithholdingTotal: 42000,
            },
          })
          .mockResolvedValueOnce({
            _sum: {
              partnerPayoutAmount: 430000,
            },
          }),
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
        groupBy: vi.fn().mockResolvedValue([{ providerProfileId: 'provider-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.DECLARED,
        notes: ' Submitted to tax portal ',
      }),
    ).resolves.toEqual(updatedClosing);

    expect(tx.monthlyTaxClosing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          period: '2026-06',
          status: MonthlyTaxClosingStatus.DECLARED,
          settlementCount: 2,
          platformFeeGrossTotal: 256000,
          platformFeeNetRevenueTotal: 237038,
          companyOutputVatTotal: 18962,
          partnerWithholdingTotal: 84000,
          declaredById: 'admin-1',
          declaredAt: expect.any(Date),
          notes: 'Submitted to tax portal',
        }),
        update: expect.objectContaining({
          status: MonthlyTaxClosingStatus.DECLARED,
          declaredById: 'admin-1',
          declaredAt: expect.any(Date),
          notes: 'Submitted to tax portal',
        }),
        where: {
          period_currency: {
            period: '2026-06',
            currency: 'VND',
          },
        },
      }),
    );
    expect(tx.bookingSettlementSnapshot.updateMany).toHaveBeenCalledWith({
      where: {
        monthlyPeriod: '2026-06',
        currency: 'VND',
        settlementStatus: BookingSettlementStatus.POSTED,
      },
      data: {
        monthlyClosingId: 'closing-1',
        taxStatus: BookingSettlementTaxStatus.DECLARED,
      },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'monthly_tax_closing.status_update',
        target: 'monthly_tax_closing:2026-06:VND',
        metadata: expect.objectContaining({
          fromStatus: MonthlyTaxClosingStatus.REVIEWED,
          toStatus: MonthlyTaxClosingStatus.DECLARED,
          settlementCount: 2,
          linkedSettlementSnapshotCount: 2,
          partnerWithholdingTotal: 84000,
          companyOutputVatTotal: 18962,
        }),
      },
    });
  });

  it('rejects direct monthly tax closing edits after a period is closed', async () => {
    const prisma = {
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: MonthlyTaxClosingStatus.CLOSED,
          declaredAt: null,
          paidAt: null,
          closedAt: new Date('2026-07-01T00:00:00.000Z'),
          notes: null,
        }),
      },
      bookingSettlementSnapshot: {
        aggregate: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.PAID,
      }),
    ).rejects.toThrow('Closed monthly periods require reversal entries, not direct edits.');
  });

  it.each([
    [MonthlyTaxClosingStatus.DRAFT, MonthlyTaxClosingStatus.PAID],
    [MonthlyTaxClosingStatus.PAID, MonthlyTaxClosingStatus.DECLARED],
  ])('rejects unsafe monthly tax closing transition from %s to %s', async (fromStatus, toStatus) => {
    const prisma = {
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: fromStatus,
          declaredAt: null,
          paidAt: null,
          closedAt: null,
          notes: null,
        }),
      },
      bookingSettlementSnapshot: {
        aggregate: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: toStatus,
      }),
    ).rejects.toThrow('Monthly tax closing status must move in order: REVIEWED, DECLARED, PAID, CLOSED.');
    expect(prisma.bookingSettlementSnapshot.aggregate).not.toHaveBeenCalled();
  });

  it('summarizes platform VAT totals and rate buckets for a monthly period', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: {
            platformFeeGross: 256000,
            platformFeeNetRevenue: 237038,
            companyOutputVat: 18962,
          },
        }),
        groupBy: vi.fn().mockResolvedValue([
          {
            platformVatRateBps: 800,
            _count: { _all: 1 },
            _sum: {
              platformFeeGross: 128000,
              platformFeeNetRevenue: 118519,
              companyOutputVat: 9481,
            },
          },
          {
            platformVatRateBps: 1000,
            _count: { _all: 1 },
            _sum: {
              platformFeeGross: 128000,
              platformFeeNetRevenue: 118519,
              companyOutputVat: 9481,
            },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.platformVatSummary({ period: '2026-06' })).resolves.toEqual({
      period: '2026-06',
      currency: 'VND',
      settlementCount: 2,
      platformFeeGrossTotal: 256000,
      platformFeeNetRevenueTotal: 237038,
      companyOutputVatTotal: 18962,
      netRevenueDelta: 0,
      rateBreakdown: [
        {
          category: 'REDUCED_8',
          platformVatRateBps: 800,
          settlementCount: 1,
          platformFeeGrossTotal: 128000,
          platformFeeNetRevenueTotal: 118519,
          companyOutputVatTotal: 9481,
        },
        {
          category: 'STANDARD_10',
          platformVatRateBps: 1000,
          settlementCount: 1,
          platformFeeGrossTotal: 128000,
          platformFeeNetRevenueTotal: 118519,
          companyOutputVatTotal: 9481,
        },
      ],
    });

    expect(prisma.bookingSettlementSnapshot.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['platformVatRateBps'],
        where: { monthlyPeriod: '2026-06' },
      }),
    );
  });

  it('summarizes payment processing fees by method, payer, and treatment for a monthly period', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: {
            customerPaymentAmount: 1200000,
            paymentProcessingFee: 10000,
          },
        }),
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            {
              paymentMethod: PaymentMethod.CASH,
              _count: { _all: 1 },
              _sum: { customerPaymentAmount: 600000, paymentProcessingFee: 0 },
            },
            {
              paymentMethod: PaymentMethod.MOMO,
              _count: { _all: 1 },
              _sum: { customerPaymentAmount: 600000, paymentProcessingFee: 10000 },
            },
          ])
          .mockResolvedValueOnce([
            {
              paymentFeePayer: PaymentFeePayer.HANDS,
              _count: { _all: 2 },
              _sum: { customerPaymentAmount: 1200000, paymentProcessingFee: 10000 },
            },
          ])
          .mockResolvedValueOnce([
            {
              paymentFeeTreatment: PaymentFeeTreatment.OPERATING_EXPENSE,
              _count: { _all: 2 },
              _sum: { customerPaymentAmount: 1200000, paymentProcessingFee: 10000 },
            },
          ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.paymentFeeSummary({ period: '2026-06' })).resolves.toEqual({
      period: '2026-06',
      currency: 'VND',
      settlementCount: 2,
      customerPaymentAmountTotal: 1200000,
      paymentProcessingFeeTotal: 10000,
      byPaymentMethod: [
        {
          paymentMethod: PaymentMethod.CASH,
          settlementCount: 1,
          customerPaymentAmountTotal: 600000,
          paymentProcessingFeeTotal: 0,
        },
        {
          paymentMethod: PaymentMethod.MOMO,
          settlementCount: 1,
          customerPaymentAmountTotal: 600000,
          paymentProcessingFeeTotal: 10000,
        },
      ],
      byPayer: [
        {
          paymentFeePayer: PaymentFeePayer.HANDS,
          settlementCount: 2,
          customerPaymentAmountTotal: 1200000,
          paymentProcessingFeeTotal: 10000,
        },
      ],
      byTreatment: [
        {
          paymentFeeTreatment: PaymentFeeTreatment.OPERATING_EXPENSE,
          settlementCount: 2,
          customerPaymentAmountTotal: 1200000,
          paymentProcessingFeeTotal: 10000,
        },
      ],
    });

    expect(prisma.bookingSettlementSnapshot.groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        by: ['paymentMethod'],
        where: { monthlyPeriod: '2026-06' },
      }),
    );
  });

  it('delegates bounded cash settlement filters to the earnings service', async () => {
    const earnings = {
      listCashSettlementDebtForAdmin: vi.fn().mockResolvedValue([{ id: 'cash-earning-1' }]),
    };
    const service = createAdminService({}, { earnings });

    await expect(
      service.listCashSettlementEarnings({
        q: 'Mai',
        range: '7d',
        queue: 'high-debt',
        skip: '25',
        take: '100',
      }),
    ).resolves.toEqual([{ id: 'cash-earning-1' }]);

    expect(earnings.listCashSettlementDebtForAdmin).toHaveBeenCalledWith({
      q: 'Mai',
      range: '7d',
      queue: 'high-debt',
      skip: '25',
      take: '100',
    });
  });

  it('delegates cash settlement summary filters to the earnings service', async () => {
    const earnings = {
      cashSettlementSummaryForAdmin: vi.fn().mockResolvedValue({ rowCount: 1, totalDebtAmount: 300000 }),
    };
    const service = createAdminService({}, { earnings });

    await expect(service.cashSettlementSummary({ q: 'booking-1', queue: 'payment-check', range: '7d' })).resolves.toEqual({
      rowCount: 1,
      totalDebtAmount: 300000,
    });

    expect(earnings.cashSettlementSummaryForAdmin).toHaveBeenCalledWith({
      q: 'booking-1',
      queue: 'payment-check',
      range: '7d',
    });
  });

  it('delegates bounded payout batch filters to the earnings service', async () => {
    const earnings = {
      listPayoutBatchesForAdmin: vi.fn().mockResolvedValue([{ id: 'payout-1' }]),
    };
    const service = createAdminService({}, { earnings });

    await expect(
      service.listPayoutBatches({
        range: '30d',
        review: 'needs-review',
        skip: '150',
        take: '75',
      }),
    ).resolves.toEqual([{ id: 'payout-1' }]);

    expect(earnings.listPayoutBatchesForAdmin).toHaveBeenCalledWith({
      range: '30d',
      review: 'needs-review',
      skip: '150',
      take: '75',
    });
  });

  it('delegates payout batch summary filters to the earnings service', async () => {
    const earnings = {
      payoutBatchSummaryForAdmin: vi.fn().mockResolvedValue({ total: 12, totalNetAmount: 900000 }),
    };
    const service = createAdminService({}, { earnings });

    await expect(
      service.payoutBatchSummary({
        range: '30d',
        review: 'needs-review',
      }),
    ).resolves.toEqual({ total: 12, totalNetAmount: 900000 });

    expect(earnings.payoutBatchSummaryForAdmin).toHaveBeenCalledWith({
      range: '30d',
      review: 'needs-review',
    });
  });

  it('audits notification retry requests after enqueueing the retry job', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const notifications = {
      retry: vi.fn().mockResolvedValue({
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
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications();

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: expect.objectContaining({
          deliveries: expect.objectContaining({
            orderBy: { attemptedAt: 'desc' },
            take: 3,
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

  it('caps notification board take to the board maximum', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications({ take: '500' });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      }),
    );
  });

  it('filters notification board rows by an explicit date range, booking id, and review queue', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications({
      booking: 'booking-1',
      from: '2026-06-27T00:00:00.000Z',
      review: 'failed',
      skip: '40',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
        where: {
          AND: [
            {
              data: {
                equals: 'booking-1',
                path: ['bookingId'],
              },
            },
            {
              deliveries: {
                some: {
                  status: 'FAILED',
                },
              },
            },
          ],
          createdAt: {
            gte: new Date('2026-06-27T00:00:00.000Z'),
            lt: new Date('2026-06-28T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('counts notification summary with the same filters without loading rows', async () => {
    const prisma = {
      notification: {
        count: vi
          .fn()
          .mockResolvedValueOnce(2400)
          .mockResolvedValueOnce(13)
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(17)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(19)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(33),
      },
      notificationDelivery: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([
          { provider: 'FCM', status: 'SENT', _count: { _all: 121 } },
          { provider: 'FCM', status: 'FAILED', _count: { _all: 51 } },
          { provider: 'IN_APP_ONLY', status: 'FAILED', _count: { _all: 64 } },
          { provider: 'SMS', status: 'SKIPPED', _count: { _all: 7 } },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.notificationSummary({
        booking: 'booking-1',
        from: '2026-06-27T00:00:00.000Z',
        review: 'failed',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      disabledDevices: 17,
      failed: 13,
      fcmDeliveries: 172,
      totalCount: 2400,
      generatedAt: expect.any(String),
      inAppDeliveries: 64,
      needsRetry: 19,
      noShow: 4,
      partnerAlertCount: 33,
      payoutSetup: 5,
      pending: 8,
      sent: 121,
      skipped: 7,
      staleDevices: 6,
    });

    expect(prisma.notification.count).toHaveBeenNthCalledWith(1, {
      where: {
        AND: [
          {
            data: {
              equals: 'booking-1',
              path: ['bookingId'],
            },
          },
          {
            deliveries: {
              some: {
                status: 'FAILED',
              },
            },
          },
        ],
        createdAt: {
          gte: new Date('2026-06-27T00:00:00.000Z'),
          lt: new Date('2026-06-28T00:00:00.000Z'),
        },
      },
    });
    expect(prisma.notification.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              deliveries: { some: { status: 'FAILED' } },
            }),
          ]),
        }),
      }),
    );
    expect(prisma.notification.count).toHaveBeenCalledTimes(9);
    expect(prisma.notificationDelivery.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['provider', 'status'],
        where: expect.objectContaining({
          notification: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-06-27T00:00:00.000Z'),
              lt: new Date('2026-06-28T00:00:00.000Z'),
            },
          }),
        }),
      }),
    );
    expect(prisma.notificationDelivery.count).not.toHaveBeenCalled();
  });

  it('rejects invalid notification board date windows', () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    expect(() =>
      service.listNotifications({
        from: '2026-06-28T00:00:00.000Z',
        to: '2026-06-27T00:00:00.000Z',
      }),
    ).toThrow('Notification date range is invalid');
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('seeds editable notification templates before listing the catalog', async () => {
    const prisma = {
      notificationTemplate: {
        findMany: vi.fn().mockResolvedValue([{ key: 'booking.matched', translations: [] }]),
        upsert: vi.fn().mockResolvedValue({ id: 'template-row' }),
      },
      notificationTemplateTranslation: {
        createMany: vi.fn().mockResolvedValue({ count: NOTIFICATION_TEMPLATE_LOCALES.length }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listNotificationTemplates()).resolves.toEqual([
      { key: 'booking.matched', translations: [] },
    ]);

    expect(prisma.notificationTemplate.upsert).toHaveBeenCalledTimes(DEFAULT_NOTIFICATION_TEMPLATES.length);
    expect(prisma.notificationTemplateTranslation.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          body: expect.any(String),
          locale: 'en',
          templateId: 'template-row',
          title: expect.any(String),
        }),
      ]),
      skipDuplicates: true,
    });
    expect(prisma.notificationTemplate.findMany).toHaveBeenCalledWith({
      orderBy: [{ audience: 'asc' }, { key: 'asc' }],
      include: {
        translations: { orderBy: { locale: 'asc' } },
      },
    });
  });

  it('bounds manual push campaign history by date range and list size', async () => {
    const prisma = {
      adminPushCampaign: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listAdminPushCampaigns({
      from: '2026-06-27T00:00:00.000Z',
      skip: '40',
      take: '500',
      to: '2026-06-28T00:00:00.000Z',
    });

    expect(prisma.adminPushCampaign.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 40,
      take: 50,
      where: {
        createdAt: {
          gte: new Date('2026-06-27T00:00:00.000Z'),
          lt: new Date('2026-06-28T00:00:00.000Z'),
        },
      },
      include: {
        recipients: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  });

  it('counts manual push campaign summary with the same date window without loading rows', async () => {
    const prisma = {
      adminPushCampaign: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 40 },
          _sum: {
            notificationCount: 780,
            recipientCount: 800,
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.adminPushCampaignSummary({
        from: '2026-06-27T00:00:00.000Z',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      generatedAt: expect.any(String),
      totalCount: 40,
      totalNotifications: 780,
      totalRecipients: 800,
    });

    expect(prisma.adminPushCampaign.aggregate).toHaveBeenCalledWith({
      _count: { _all: true },
      _sum: {
        notificationCount: true,
        recipientCount: true,
      },
      where: {
        createdAt: {
          gte: new Date('2026-06-27T00:00:00.000Z'),
          lt: new Date('2026-06-28T00:00:00.000Z'),
        },
      },
    });
  });

  it('rejects invalid manual push campaign history date windows', () => {
    const prisma = {
      adminPushCampaign: {
        findMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    expect(() =>
      service.listAdminPushCampaigns({
        from: '2026-06-28T00:00:00.000Z',
        to: '2026-06-27T00:00:00.000Z',
      }),
    ).toThrow('Push campaign date range is invalid');
    expect(prisma.adminPushCampaign.findMany).not.toHaveBeenCalled();
  });

  it('previews manual push recipients only for users with active devices in the selected role', async () => {
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'customer-user-1',
            phone: '+84000000000',
            fullName: 'Demo Customer',
            roles: [Role.CUSTOMER],
            pushDevices: [{ id: 'push-device-1', platform: 'ios', role: Role.CUSTOMER }],
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.previewAdminPushCampaign({
        targetRole: Role.CUSTOMER,
        title: 'HANDS update',
        body: 'Your booking update is ready.',
      }),
    ).resolves.toMatchObject({
      targetRole: Role.CUSTOMER,
      targetSegment: 'all',
      appDestination: 'notificationCenter',
      recipientCount: 2,
      willSendCount: 2,
      capped: false,
    });

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        roles: { has: Role.CUSTOMER },
        pushDevices: { some: { enabled: true, role: Role.CUSTOMER } },
      },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: {
          roles: { has: Role.CUSTOMER },
          pushDevices: { some: { enabled: true, role: Role.CUSTOMER } },
        },
      }),
    );
  });

  it('previews manual push customer segments with booking and session filters', async () => {
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.previewAdminPushCampaign({
        targetRole: Role.CUSTOMER,
        targetSegment: 'customer_completed_last_7_days',
        title: 'Welcome back',
        body: 'Thanks for completing your recent booking.',
      }),
    ).resolves.toMatchObject({
      targetRole: Role.CUSTOMER,
      targetSegment: 'customer_completed_last_7_days',
      recipientCount: 3,
    });

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            roles: { has: Role.CUSTOMER },
            pushDevices: { some: { enabled: true, role: Role.CUSTOMER } },
          },
          {
            customerProfile: {
              is: {
                bookings: {
                  some: {
                    status: BookingStatus.COMPLETED,
                    OR: [
                      { closedAt: { gte: expect.any(Date) } },
                      { closedAt: null, updatedAt: { gte: expect.any(Date) } },
                    ],
                  },
                },
              },
            },
          },
        ],
      },
    });
  });

  it('rejects manual push campaigns to admin accounts', async () => {
    const service = createAdminService({});

    await expect(
      service.previewAdminPushCampaign({
        targetRole: Role.ADMIN,
        title: 'Admin test',
        body: 'No admin pushes from this workspace.',
      }),
    ).rejects.toThrow('Manual push target role must be CUSTOMER or PROVIDER');
  });

  it('creates manual push campaigns through persistent notifications and audit logs', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      adminPushCampaign: {
        create: vi.fn().mockResolvedValue({
          id: 'campaign-1',
          targetRole: Role.PROVIDER,
          recipientCount: 2,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'campaign-1',
          notificationCount: 2,
          recipients: [],
        }),
      },
      adminPushCampaignRecipient: {
        create: vi.fn().mockResolvedValue({ id: 'recipient-1' }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 'partner-user-1' }, { id: 'partner-user-2' }]),
      },
    };
    const notifications = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: 'notification-1' })
        .mockResolvedValueOnce({ id: 'notification-2' }),
    };
    const service = createAdminService(prisma, { notifications });

    await expect(
      service.createAdminPushCampaign('admin-1', {
        targetRole: Role.PROVIDER,
        appDestination: 'earnings',
        locale: 'vi',
        title: 'Partner update',
        body: 'A new HANDS update is ready.',
      }),
    ).resolves.toMatchObject({ id: 'campaign-1', notificationCount: 2 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: {
          roles: { has: Role.PROVIDER },
          pushDevices: { some: { enabled: true, role: Role.PROVIDER } },
        },
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith({
      userId: 'partner-user-1',
      targetRole: Role.PROVIDER,
      type: 'admin.push.broadcast',
      resolveTemplate: false,
      title: 'Partner update',
      body: 'A new HANDS update is ready.',
      data: {
        campaignId: 'campaign-1',
        source: 'admin_manual_push',
        targetSegment: 'all',
        destination: 'earnings',
      },
    });
    expect(prisma.adminPushCampaignRecipient.create).toHaveBeenCalledTimes(2);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin_push_campaign.create',
        actorId: 'admin-1',
        target: 'admin_push_campaign:campaign-1',
      }),
    });
  });

  it('audits push device enablement without recording raw push tokens', async () => {
    const prisma = {
      pushDevice: {
        update: vi.fn().mockResolvedValue({
          id: 'push-device-1',
          platform: 'ios',
          token: 'raw-fcm-token',
          userId: 'user-1',
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
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

  it('approves post-match cancellations and restores unpaid partner earning', async () => {
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
          notes: null,
          matchedAt: new Date('2026-06-13T10:00:00.000Z'),
          selectedProviderId: 'partner-1',
          closedAt: new Date('2026-06-13T10:10:00.000Z'),
          closedByRole: Role.PROVIDER,
          closedReason: 'partner_cancelled',
          closedNote: 'Partner cancelled from chat.',
          earning: {
            id: 'earning-1',
            bookingId: 'booking-1',
            providerProfileId: 'partner-1',
            netAmount: -30000,
            currency: 'VND',
            status: EarningStatus.PENDING,
          },
        }),
        update: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
          closedReason: 'post_match_cancellation_approved',
        }),
      },
      providerEarning: {
        update: vi.fn().mockResolvedValue({
          id: 'earning-1',
          status: EarningStatus.CANCELLED,
          netAmount: 0,
        }),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.approvePostMatchCancellation('admin-1', 'booking-1', {
        note: 'Evidence checked',
      }),
    ).resolves.toMatchObject({
      id: 'booking-1',
      closedReason: 'post_match_cancellation_approved',
    });

    expect(tx.providerEarning.update).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      data: {
        status: EarningStatus.CANCELLED,
        netAmount: 0,
      },
    });
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          providerProfileId: 'partner-1',
          bookingId: 'booking-1',
          earningId: 'earning-1',
          type: ProviderWalletLedgerType.REFUND_REVERSAL,
          sourceKey: 'earning:earning-1:post-match-cancellation-approval',
          amount: 30000,
          currency: 'VND',
        }),
      }),
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          closedByRole: Role.ADMIN,
          closedReason: 'post_match_cancellation_approved',
          closedNote: 'Evidence checked',
          notes: expect.stringContaining('Post-match cancellation approved by operations'),
          opsTasks: {
            upsert: expect.objectContaining({
              where: {
                bookingId_type: {
                  bookingId: 'booking-1',
                  type: BookingOpsTaskType.PAYMENT_REVIEWED,
                },
              },
              update: expect.objectContaining({
                status: BookingOpsTaskStatus.DONE,
                note: 'Evidence checked',
                actorId: 'admin-1',
              }),
            }),
          },
        }),
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-1',
        action: 'booking.post_match_cancellation.approve',
        target: 'booking:booking-1',
        metadata: expect.objectContaining({
          bookingId: 'booking-1',
          previousClosedByRole: Role.PROVIDER,
          previousClosedReason: 'partner_cancelled',
          minutesAfterMatch: 10,
          autoApprovalWindow: true,
          decision: 'APPROVED',
          note: 'Evidence checked',
          earningResult: expect.objectContaining({
            skipped: false,
            earningId: 'earning-1',
            previousNetAmount: -30000,
            netAmount: 0,
          }),
        }),
      }),
    });
  });

  it('holds post-match cancellations without restoring the partner fee deduction', async () => {
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
          notes: 'existing note',
          matchedAt: new Date('2026-06-13T10:00:00.000Z'),
          selectedProviderId: 'partner-1',
          closedAt: new Date('2026-06-13T10:30:00.000Z'),
          closedByRole: Role.PROVIDER,
          closedReason: 'partner_cancelled',
          closedNote: 'Partner cancelled from chat.',
          earning: {
            id: 'earning-1',
            bookingId: 'booking-1',
            providerProfileId: 'partner-1',
            netAmount: -30000,
            currency: 'VND',
            status: EarningStatus.PENDING,
          },
        }),
        update: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
          closedReason: 'post_match_cancellation_fee_held',
        }),
      },
      providerEarning: {
        update: vi.fn(),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.holdPostMatchCancellation('admin-1', 'booking-1', {
        note: 'Fee hold remains',
      }),
    ).resolves.toMatchObject({
      id: 'booking-1',
      closedReason: 'post_match_cancellation_fee_held',
    });

    expect(tx.providerEarning.update).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closedByRole: Role.ADMIN,
          closedReason: 'post_match_cancellation_fee_held',
          closedNote: 'Fee hold remains',
        }),
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'booking.post_match_cancellation.hold',
        metadata: expect.objectContaining({
          minutesAfterMatch: 30,
          autoApprovalWindow: false,
          decision: 'HELD',
          earningResult: { skipped: true, reason: 'FEE_HELD_BY_ADMIN_DECISION' },
        }),
      }),
    });
  });

  it('rejects post-match cancellation decisions for pre-match cancellations', async () => {
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
          notes: null,
          matchedAt: null,
          selectedProviderId: null,
          closedAt: new Date('2026-06-13T10:10:00.000Z'),
          closedByRole: Role.CUSTOMER,
          closedReason: 'customer_cancelled_before_match',
          closedNote: null,
          earning: null,
        }),
        update: vi.fn(),
      },
      providerEarning: {
        update: vi.fn(),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(service.approvePostMatchCancellation('admin-1', 'booking-1')).rejects.toThrow(
      'Post-match cancellation requires matching evidence',
    );
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('moderates a review, recalculates published rating, and writes an audit log', async () => {
    const tx = {
      review: {
        update: vi.fn().mockResolvedValue({
          id: 'review-1',
          providerProfileId: 'partner-1',
          status: 'HIDDEN',
        }),
        aggregate: vi.fn().mockResolvedValue({
          _avg: { rating: 4 },
          _count: { rating: 3 },
        }),
      },
      providerProfile: {
        update: vi.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.moderateReview('admin-1', 'review-1', {
        status: 'HIDDEN' as never,
        rating: 4,
        comment: '  Updated review copy  ',
        reportReason: 'Held by admin',
      }),
    ).resolves.toMatchObject({
      id: 'review-1',
      providerProfileId: 'partner-1',
    });

    expect(tx.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: {
        status: 'HIDDEN',
        rating: 4,
        comment: 'Updated review copy',
        reportReason: 'Held by admin',
        moderatedAt: expect.any(Date),
      },
    });
    expect(tx.review.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'partner-1', status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { rating: true },
    });
    expect(tx.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: {
        ratingAvg: 4,
        reviewCount: 3,
      },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'review.moderate',
        target: 'review:review-1',
        metadata: {
          status: 'HIDDEN',
          rating: 4,
          comment: 'Updated review copy',
          reportReason: 'Held by admin',
        },
      },
    });
  });

  it('lists partner customer evaluations with booking and profile summaries', async () => {
    const prisma = {
      providerCustomerReview: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'evaluation-1',
            bookingId: 'booking-1',
            customerProfileId: 'customer-1',
            providerProfileId: 'partner-1',
            comment: 'Customer was ready on arrival.',
            status: 'PUBLISHED',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      (
        service as unknown as {
          listPartnerCustomerReviews: () => Promise<unknown>;
        }
      ).listPartnerCustomerReviews(),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'evaluation-1',
        customerProfileId: 'customer-1',
        providerProfileId: 'partner-1',
      }),
    ]);

    expect(prisma.providerCustomerReview.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 25,
      where: undefined,
      select: expect.objectContaining({
        id: true,
        bookingId: true,
        customerProfileId: true,
        providerProfileId: true,
        comment: true,
        status: true,
        reportReason: true,
        moderatedAt: true,
        createdAt: true,
        booking: expect.any(Object),
        customerProfile: expect.any(Object),
        providerProfile: expect.any(Object),
      }),
    });
  });

  it('lists customer reviews with bounded filters and summary counts', async () => {
    const prisma = {
      review: {
        findMany: vi.fn().mockResolvedValue([{ id: 'review-1' }]),
        count: vi.fn().mockResolvedValue(8),
        groupBy: vi.fn().mockResolvedValue([{ status: 'HIDDEN', _count: { _all: 8 } }]),
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.5 } }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listReviews({
        from: '2026-06-27T00:00:00.000Z',
        q: 'mai',
        review: 'held',
        skip: '25',
        sort: 'rating-desc',
        take: '25',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toEqual([{ id: 'review-1' }]);
    await expect(
      service.reviewSummary({
        from: '2026-06-27T00:00:00.000Z',
        q: 'mai',
        review: 'held',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toEqual({
      averageRating: 4.5,
      generatedAt: expect.any(String),
      held: 8,
      published: 0,
      reported: 0,
      totalCount: 8,
    });

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        skip: 25,
        take: 25,
        where: expect.objectContaining({
          status: 'HIDDEN',
          createdAt: {
            gte: new Date('2026-06-27T00:00:00.000Z'),
            lt: new Date('2026-06-28T00:00:00.000Z'),
          },
          OR: expect.any(Array),
        }),
      }),
    );
    expect(prisma.review.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'HIDDEN' }),
    });
    expect(prisma.review.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: expect.objectContaining({ status: 'HIDDEN' }),
      _count: { _all: true },
    });
    expect(prisma.review.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'HIDDEN' }),
      _avg: { rating: true },
    });
  });

  it('lists partner customer evaluations with bounded filters and summary counts', async () => {
    const prisma = {
      providerCustomerReview: {
        findMany: vi.fn().mockResolvedValue([{ id: 'evaluation-1' }]),
        count: vi.fn().mockResolvedValue(4),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerCustomerReviews({
        from: '2026-06-27T00:00:00.000Z',
        q: 'late',
        skip: '20',
        sort: 'oldest',
        take: '10',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toEqual([{ id: 'evaluation-1' }]);
    await expect(
      service.partnerCustomerReviewSummary({
        from: '2026-06-27T00:00:00.000Z',
        q: 'late',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toEqual({
      generatedAt: expect.any(String),
      totalCount: 4,
    });

    expect(prisma.providerCustomerReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
        skip: 20,
        take: 10,
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-06-27T00:00:00.000Z'),
            lt: new Date('2026-06-28T00:00:00.000Z'),
          },
          OR: expect.any(Array),
        }),
      }),
    );
    expect(prisma.providerCustomerReview.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    });
  });

  it('scopes review lists to a provider profile for detail pages', async () => {
    const prisma = {
      review: {
        findMany: vi.fn().mockResolvedValue([{ id: 'review-1' }]),
      },
      providerCustomerReview: {
        findMany: vi.fn().mockResolvedValue([{ id: 'evaluation-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listReviews({ providerProfileId: 'provider-1', take: '50' }),
    ).resolves.toEqual([{ id: 'review-1' }]);
    await expect(
      service.listPartnerCustomerReviews({ providerProfileId: 'provider-1', take: '50' }),
    ).resolves.toEqual([{ id: 'evaluation-1' }]);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        where: expect.objectContaining({ providerProfileId: 'provider-1' }),
      }),
    );
    expect(prisma.providerCustomerReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        where: expect.objectContaining({ providerProfileId: 'provider-1' }),
      }),
    );
  });
});
