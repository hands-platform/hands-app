import {
  BookingMatchSource,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
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
        take: 500,
      }),
    );
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
      take: 100,
      select: expect.objectContaining({
        action: true,
        actor: expect.any(Object),
        createdAt: true,
        metadata: true,
        target: true,
      }),
    });
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
      take: 100,
      select: expect.objectContaining({
        action: true,
        actor: expect.any(Object),
        createdAt: true,
        metadata: true,
        target: true,
      }),
    });
  });

  it('attaches recent coupon booking usage to coupon list rows', async () => {
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
        findMany: vi.fn().mockResolvedValue([booking]),
      },
      coupon: {
        findMany: vi.fn().mockResolvedValue([coupon]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listCoupons()).resolves.toEqual([
      expect.objectContaining({
        code: 'WELCOME10',
        usageBookings: [
          expect.objectContaining({
            amount: 270000,
            bookingId: 'booking-1',
            customerName: 'Demo Customer',
            discountAmount: 30000,
            partnerName: 'Smoke Partner',
            serviceName: 'Massage / 60 min',
          }),
        ],
      }),
    ]);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 500,
        where: { payment: { isNot: null } },
      }),
    );
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
        reason: 'launch referral program',
      }),
    ).resolves.toMatchObject({
      audience: ReferralAudience.CUSTOMER,
      enabled: true,
      commissionPercentBps: 600,
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
          rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        }),
        update: expect.objectContaining({
          updatedById: 'admin-1',
          commissionPercentBps: 600,
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
        findMany: vi.fn().mockResolvedValue([
          {
            spendDate: new Date('2026-06-20T00:00:00.000Z'),
            source: 'google',
            platform: 'android',
            regionCode: 'hcm',
            campaignId: 'launch-hcm',
            campaignName: 'Launch HCMC',
            spendAmount: 600_000,
            currency: 'VND',
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
    expect(prisma.marketingSpendDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'google',
          platform: 'android',
          regionCode: 'hcm',
          campaignId: 'launch-hcm',
        }),
      }),
    );
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

    await expect(service.listCustomerReferralParents()).resolves.toEqual([
      expect.objectContaining({
        referrer: expect.objectContaining({ id: 'parent-customer' }),
        referralCode: expect.objectContaining({ code: 'HANDSCUST' }),
        referrals: [
          expect.objectContaining({
            referredCustomer: expect.objectContaining({ id: 'referred-customer' }),
            rewards: expect.arrayContaining([
              expect.objectContaining({
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
        where: { referralsMade: { some: { audience: ReferralAudience.CUSTOMER } } },
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
        action: { in: ['referral_reward.hold', 'referral_reward.credit', 'referral_reward.reverse'] },
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

    await service.listBookingNotifications('booking-1');

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 100,
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

    await expect(service.listBookingMarketplaceProviders('booking-1')).resolves.toEqual([
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
        take: 120,
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
    expect(overview.points).toEqual(overview.realtimePoints);
    expect(overview.realtimePoints.map((point) => point.kind).sort()).toEqual([
      'active',
      'bookings',
      'online',
    ]);
    expect(serialized).toContain('latitude');
    expect(serialized).toContain('longitude');
    expect(serialized).not.toContain('currentLat');
    expect(serialized).not.toContain('currentLng');
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
    expect(query).toEqual(expect.objectContaining({ take: 500 }));
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
        take: 500,
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

    await expect(service.listOperationsPolicyProviders()).resolves.toEqual([
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
        take: 500,
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

    await expect(service.listOperationsHandoffProviders()).resolves.toEqual([
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
    expect(query).toEqual(expect.objectContaining({ take: 500 }));
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

    await expect(service.listPartnerControlProviders()).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-1',
        activitySummary: expect.objectContaining({ walletBalance: -70000 }),
        earnings: [{ netAmount: -70000, status: EarningStatus.PENDING }],
      }),
    ]);

    const query = prisma.providerProfile.findMany.mock.calls[0][0];
    const select = query.select;
    expect(query).toEqual(expect.objectContaining({ take: 500 }));
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
          bookingCount: 17,
          completedBookingCount: 12,
          lastBookingAt,
          lastCompletedBookingAt,
        },
      }),
    ]);
    expect(prisma.booking.groupBy).toHaveBeenCalledTimes(2);
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
        take: 60,
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
        take: 100,
      }),
    );
  });

  it('filters notification board rows by an explicit date range', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications({
      from: '2026-06-27T00:00:00.000Z',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: {
          createdAt: {
            gte: new Date('2026-06-27T00:00:00.000Z'),
            lt: new Date('2026-06-28T00:00:00.000Z'),
          },
        },
      }),
    );
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
      take: 100,
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
});
