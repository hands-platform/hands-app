import {
  AccountingJournalBatchStatus,
  AccountingJournalEntrySide,
  AccountingJournalSourceType,
  AdminOperatorPermissionCategory,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  BankReconciliationStatus,
  BookingMatchSource,
  BookingPaymentClearingStatus,
  BookingPaymentClearingEntryType,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  CompanyBankAccountStatus,
  EarningStatus,
  MonthlyTaxClosingStatus,
  ManualWalletAdjustmentRequestStatus,
  PartnerBankDepositRequestStatus,
  ParticipantStatus,
  PayoutBatchStatus,
  PaymentStatus,
  CompanyBankTransactionType,
  PaymentFeePayer,
  PaymentFeeRuleType,
  PaymentFeeTreatment,
  PaymentMethod,
  ProviderBankAccountStatus,
  ProviderKycStatus,
  ProviderReportSeverity,
  ProviderReportStatus,
  ProviderSanctionStatus,
  ProviderStatus,
  ProviderTaxProfileStatus,
  ProviderWalletWithdrawalRequestStatus,
  ProviderWalletLedgerType,
  Prisma,
  CustomerWalletLedgerType,
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralRewardMode,
  ReferralRewardStatus,
  ReviewStatus,
  Role,
} from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_LOCALES,
} from '../notifications/notification-template-catalog';
import { ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT } from './admin-booking-detail-selects';
import { ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT } from './admin-booking-selects';
import { AdminService, partnerOverviewCitySearchTerms } from './admin.service';

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

function providerMapFixture(input: {
  id: string;
  status: ProviderStatus;
  user: { appSessions: Array<{ lastSeenAt: Date }> };
}) {
  return {
    city: 'Ha Noi',
    currentLat: 21.0285,
    currentLng: 105.8542,
    currentLocationUpdatedAt: input.user.appSessions[0]?.lastSeenAt ?? new Date(),
    displayName: input.id,
    id: input.id,
    residentialAddress: 'Cau Giay, Ha Noi',
    serviceArea: null,
    status: input.status,
    user: input.user,
  };
}

describe('partnerOverviewCitySearchTerms', () => {
  it('expands common Vietnam city aliases used by Admin filters', () => {
    expect(partnerOverviewCitySearchTerms('hcm')).toEqual([
      'hcm',
      'hcmc',
      'ho chi minh',
      'sai gon',
      'saigon',
    ]);
    expect(partnerOverviewCitySearchTerms('Saigon')).toContain('ho chi minh');
    expect(partnerOverviewCitySearchTerms('hn')).toEqual(['hn', 'hanoi', 'ha noi']);
    expect(partnerOverviewCitySearchTerms('Da Nang')).toEqual(['Da Nang']);
  });
});

describe('AdminService partner overview request events', () => {
  it('keeps the required Partner Overview action queues and segments visible even when empty', async () => {
    const prisma = {
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      review: {
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bookingParticipant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      customerProviderProfileView: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      customerFavoriteProvider: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      massageService: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bookingService: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerReport: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerEarning: {
        aggregate: vi
          .fn()
          .mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerBookingRequestEvent: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ avgSeconds: null }]),
    };
    const service = createAdminService(prisma);

    const overview = await service.getPartnerOverview({ range: '7d' });

    expect(overview.actionLists.map((list) => list.key)).toEqual([
      'pending-verification',
      'approved-never-online',
      'approved-no-first-booking',
      'inactive-7d',
      'inactive-30d',
      'high-cancellation',
      'no-show-risk',
      'low-rating',
      'negative-wallet',
      'payout-blocked',
      'tax-info-missing',
    ]);
    expect(overview.segments.map((segment) => segment.key)).toEqual([
      'pending',
      'documents-missing',
      'approved-inactive',
      'first-job',
      'high-activity',
      'high-rating',
      'low-rating',
      'high-cancellation',
      'no-show',
      'negative-wallet',
      'payout-blocked',
      'churn-risk',
      'overpriced',
    ]);
  });

  it('applies riskStatus to derived Partner Overview queues and segments', async () => {
    const oldDate = new Date('2026-05-01T00:00:00.000Z');
    const providerRow = (id: string, name: string) => ({
      id,
      displayName: name,
      city: 'Ho Chi Minh City',
      residentialAddress: 'District 1, Ho Chi Minh City',
      serviceArea: null,
      status: ProviderStatus.OFFLINE,
      ratingAvg: 4.8,
      reviewCount: 4,
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: oldDate,
      blockedAt: null,
      blockedReason: null,
      updatedAt: oldDate,
      user: {
        createdAt: oldDate,
        fullName: name,
        phone: `+849${id}`,
      },
      verification: {
        reviewedAt: oldDate,
        status: 'APPROVED',
        submittedAt: oldDate,
      },
      kyc: {
        reviewedAt: oldDate,
        status: ProviderKycStatus.APPROVED,
        submittedAt: oldDate,
      },
      taxProfile: {
        status: ProviderTaxProfileStatus.APPROVED,
      },
      services: [
        {
          serviceId: 'svc-foot-45',
          service: {
            active: true,
            durationMin: 60,
            id: 'svc-foot-45',
            name: 'Foot Massage',
          },
        },
      ],
      sessions: [],
      selectedBookings: [],
    });
    const prisma = {
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'critical-wallet',
            _sum: { amount: -100_000 },
          },
        ]),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi
          .fn()
          .mockResolvedValue([
            providerRow('critical-wallet', 'Critical Wallet Partner'),
            providerRow('high-inactive', 'High Inactive Partner'),
          ]),
      },
      review: {
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bookingParticipant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      customerProviderProfileView: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      customerFavoriteProvider: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      massageService: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bookingService: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerReport: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerEarning: {
        aggregate: vi
          .fn()
          .mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerBookingRequestEvent: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ avgSeconds: null }]),
    };
    const service = createAdminService(prisma);

    const overview = await service.getPartnerOverview({ range: '7d', riskStatus: 'high' });

    expect(overview.filters.riskStatus).toBe('high');
    expect(overview.actionLists.find((list) => list.key === 'negative-wallet')?.totalCount).toBe(0);
    expect(overview.actionLists.find((list) => list.key === 'inactive-30d')?.totalCount).toBe(1);
    expect(overview.segments.find((segment) => segment.key === 'negative-wallet')?.count).toBe(0);
    expect(overview.segments.find((segment) => segment.key === 'churn-risk')?.count).toBe(1);
  });

  it('computes Partner Overview area response time from participant response records', async () => {
    const prisma = {
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      review: {
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bookingParticipant: {
        findMany: vi.fn().mockResolvedValue([
          {
            joinedAt: new Date('2026-06-27T03:00:00.000Z'),
            respondedAt: new Date('2026-06-27T03:01:30.000Z'),
            booking: {
              address: 'District 1, Ho Chi Minh City',
              addressSnapshot: {
                address: 'District 1, Ho Chi Minh City',
                addressText: 'District 1, Ho Chi Minh City',
                latitude: 10.7769,
                longitude: 106.7009,
              },
              lat: 10.7769,
              lng: 106.7009,
            },
          },
          {
            joinedAt: new Date('2026-06-27T04:00:00.000Z'),
            respondedAt: new Date('2026-06-27T04:02:00.000Z'),
            booking: {
              address: 'District 3, Ho Chi Minh City',
              addressSnapshot: {
                address: 'District 3, Ho Chi Minh City',
                addressText: 'District 3, Ho Chi Minh City',
                latitude: 10.782,
                longitude: 106.687,
              },
              lat: 10.782,
              lng: 106.687,
            },
          },
        ]),
      },
      customerProviderProfileView: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      customerFavoriteProvider: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      massageService: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bookingService: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerReport: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerEarning: {
        aggregate: vi
          .fn()
          .mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerBookingRequestEvent: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ avgSeconds: 105 }]),
    };
    const service = createAdminService(prisma);

    const overview = await service.getPartnerOverview({ range: '7d' });

    expect(overview.summaryKpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'averageResponseTime',
          value: 105,
        }),
      ]),
    );
    expect(overview.supplyHealth.areas.find((row) => row.areaCode === 'hcm')).toEqual(
      expect.objectContaining({
        averageResponseSeconds: 105,
      }),
    );
    expect(prisma.bookingParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: expect.any(Number),
        where: expect.objectContaining({
          respondedAt: { not: null },
        }),
      }),
    );
  });

  it('surfaces Partner Overview selection friction from viewed and favorited providers without completed work', async () => {
    const providerUpdatedAt = new Date('2026-06-27T03:00:00.000Z');
    const prisma = {
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'provider-viewed-not-booked',
            displayName: 'Viewed Not Booked',
            city: 'Ho Chi Minh City',
            residentialAddress: 'District 1, Ho Chi Minh City',
            serviceArea: null,
            status: ProviderStatus.ONLINE_AVAILABLE_SOON,
            nextAvailableAt: new Date('2026-06-27T06:30:00.000Z'),
            ratingAvg: 4.7,
            reviewCount: 12,
            currentLat: 10.7769,
            currentLng: 106.7009,
            currentLocationUpdatedAt: providerUpdatedAt,
            blockedAt: null,
            blockedReason: null,
            updatedAt: providerUpdatedAt,
            user: {
              createdAt: providerUpdatedAt,
              fileAssets: [],
              fullName: 'Viewed Not Booked',
              phone: '+84900003333',
            },
            verification: {
              reviewedAt: providerUpdatedAt,
              status: 'APPROVED',
              submittedAt: providerUpdatedAt,
            },
            kyc: {
              reviewedAt: providerUpdatedAt,
              status: ProviderKycStatus.APPROVED,
              submittedAt: providerUpdatedAt,
            },
            taxProfile: {
              status: ProviderTaxProfileStatus.APPROVED,
            },
            services: [
              {
                serviceId: 'svc-foot-45',
                service: {
                  active: true,
                  basePrice: 300_000,
                  durationMin: 45,
                  id: 'svc-foot-45',
                  name: 'Foot Massage',
                },
                price: 550_000,
              },
            ],
            sessions: [{ appVersion: '1.0.0', lastSeenAt: providerUpdatedAt }],
            selectedBookings: [],
          },
          {
            id: 'provider-price-only',
            displayName: 'Price Only',
            city: 'Ho Chi Minh City',
            residentialAddress: 'District 3, Ho Chi Minh City',
            serviceArea: null,
            status: ProviderStatus.ONLINE_AVAILABLE,
            nextAvailableAt: null,
            ratingAvg: 4.8,
            reviewCount: 8,
            currentLat: 10.782,
            currentLng: 106.687,
            currentLocationUpdatedAt: providerUpdatedAt,
            blockedAt: null,
            blockedReason: null,
            updatedAt: providerUpdatedAt,
            user: {
              createdAt: providerUpdatedAt,
              fileAssets: [],
              fullName: 'Price Only',
              phone: '+84900004444',
            },
            verification: {
              reviewedAt: providerUpdatedAt,
              status: 'APPROVED',
              submittedAt: providerUpdatedAt,
            },
            kyc: {
              reviewedAt: providerUpdatedAt,
              status: ProviderKycStatus.APPROVED,
              submittedAt: providerUpdatedAt,
            },
            taxProfile: {
              status: ProviderTaxProfileStatus.APPROVED,
            },
            services: [
              {
                serviceId: 'svc-foot-45',
                service: {
                  active: true,
                  basePrice: 300_000,
                  durationMin: 45,
                  id: 'svc-foot-45',
                  name: 'Foot Massage',
                },
                price: 650_000,
              },
            ],
            sessions: [{ appVersion: '1.0.0', lastSeenAt: providerUpdatedAt }],
            selectedBookings: [],
          },
        ]),
      },
      review: {
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bookingParticipant: {
        findMany: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'provider-viewed-not-booked',
            joinedAt: new Date('2026-06-27T03:00:00.000Z'),
            respondedAt: new Date('2026-06-27T03:03:00.000Z'),
            booking: {
              address: 'District 1, Ho Chi Minh City',
              addressSnapshot: {
                address: 'District 1, Ho Chi Minh City',
                addressText: 'District 1, Ho Chi Minh City',
                latitude: 10.7769,
                longitude: 106.7009,
              },
              lat: 10.7769,
              lng: 106.7009,
            },
          },
          {
            providerProfileId: 'provider-price-only',
            joinedAt: new Date('2026-06-27T03:00:00.000Z'),
            respondedAt: new Date('2026-06-27T03:01:00.000Z'),
            booking: {
              address: 'District 3, Ho Chi Minh City',
              addressSnapshot: {
                address: 'District 3, Ho Chi Minh City',
                addressText: 'District 3, Ho Chi Minh City',
                latitude: 10.782,
                longitude: 106.687,
              },
              lat: 10.782,
              lng: 106.687,
            },
          },
        ]),
      },
      customerProviderProfileView: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'provider-viewed-not-booked',
            _count: { _all: 4 },
            _sum: { viewCount: 18 },
            _max: { lastViewedAt: providerUpdatedAt },
          },
          {
            providerProfileId: 'provider-price-only',
            _count: { _all: 2 },
            _sum: { viewCount: 12 },
            _max: { lastViewedAt: providerUpdatedAt },
          },
        ]),
      },
      customerFavoriteProvider: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'provider-viewed-not-booked',
            _count: { _all: 3 },
            _max: { createdAt: providerUpdatedAt },
          },
        ]),
      },
      massageService: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bookingService: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerReport: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerEarning: {
        aggregate: vi
          .fn()
          .mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerBookingRequestEvent: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ avgSeconds: null }]),
    };
    const service = createAdminService(prisma);

    const overview = await service.getPartnerOverview({
      range: '7d',
      selectionIssue: 'availability',
      selectionSort: 'response',
    });

    expect(overview.filters).toEqual(
      expect.objectContaining({
        selectionIssue: 'availability',
        selectionSort: 'response',
      }),
    );
    expect(overview.selectionFriction.rows.map((row) => row.partnerId)).toEqual([
      'provider-viewed-not-booked',
    ]);
    expect(overview).toEqual(
      expect.objectContaining({
        selectionFriction: expect.objectContaining({
          issueCounts: expect.arrayContaining([
            expect.objectContaining({ count: 2, key: 'all', label: 'All' }),
            expect.objectContaining({ count: 1, key: 'availability', label: 'Availability' }),
            expect.objectContaining({ count: 2, key: 'price', label: 'Price' }),
            expect.objectContaining({ count: 2, key: 'profile', label: 'Profile' }),
            expect.objectContaining({ count: 1, key: 'response', label: 'Response' }),
            expect.objectContaining({ count: 0, key: 'service', label: 'Service' }),
          ]),
          rows: [
            expect.objectContaining({
              completedBookings: 0,
              activeServiceCount: 1,
              availabilityStatus: 'Available soon',
              averageResponseSeconds: 180,
              favoriteCount: 3,
              galleryImageCount: 0,
              hasProfileImage: false,
              mainReason: 'High views, no completed booking',
              maxServicePrice: 550000,
              minServicePrice: 550000,
              partnerId: 'provider-viewed-not-booked',
              partnerName: 'Viewed Not Booked',
              nextAvailableAt: '2026-06-27T06:30:00.000Z',
              profileViews: 18,
              readinessFlags: expect.arrayContaining([
                'Available soon',
                'No approved profile image',
                'High partner price',
              ]),
              recommendedAction: 'Review profile pricing and photos',
              selectionRate: 0,
            }),
          ],
        }),
        operatingStatus: expect.objectContaining({
          cards: expect.arrayContaining([
            expect.objectContaining({
              count: 0,
              detail: 'Approved, online, fresh location, active services, and wallet eligible',
              href: '/partners?review=marketplace-ready&onlineStatus=available',
              key: 'ready-now',
              label: 'Ready now',
              tone: 'success',
            }),
            expect.objectContaining({
              count: 1,
              detail: 'Partner marked available soon instead of ready now',
              href: '/partners?review=marketplace-ready&onlineStatus=soon',
              key: 'available-soon',
              label: 'Available soon',
              tone: 'info',
            }),
            expect.objectContaining({
              count: 2,
              detail: 'Auto-offline follow-up queue for approved partners',
              href: '/partners?review=marketplace-ready&activity=inactive-7d',
              key: 'inactive-7d',
              label: 'Inactive 7D',
              tone: 'danger',
            }),
          ]),
        }),
      }),
    );
  });

  it('counts persisted partner request list and detail view events in the funnel', async () => {
    const prisma = {
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      review: {
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bookingParticipant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      customerProviderProfileView: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      customerFavoriteProvider: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      massageService: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bookingService: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerReport: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerEarning: {
        aggregate: vi
          .fn()
          .mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerBookingRequestEvent: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([{ providerProfileId: 'provider-list-viewer' }])
          .mockResolvedValueOnce([{ providerProfileId: 'provider-detail-viewer' }]),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { metadata: { durationSeconds: 40 } },
            { metadata: { durationSeconds: 80 } },
            { metadata: { durationSeconds: 'invalid' } },
          ]),
      },
      notification: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ avgSeconds: null }]),
    };
    const service = createAdminService(prisma);

    const overview = await service.getPartnerOverview({ range: '7d' });

    expect(overview.funnel.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          count: 1,
          dataStatus: 'available',
          key: 'request-viewed',
          label: 'Request Viewed',
        }),
        expect.objectContaining({
          count: 1,
          dataStatus: 'available',
          key: 'request-detailed',
          label: 'Request Detailed',
        }),
      ]),
    );
    expect(overview.summaryKpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: 'Heartbeat/close telemetry',
          key: 'averageDetailViewTime',
          label: 'Average Detail View Time',
          unit: 'seconds',
          value: 60,
        }),
      ]),
    );
    expect(prisma.providerBookingRequestEvent.groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        by: ['providerProfileId'],
        where: expect.objectContaining({ eventType: 'OPEN_REQUEST_LIST_VIEWED' }),
      }),
    );
    expect(prisma.providerBookingRequestEvent.groupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        by: ['providerProfileId'],
        where: expect.objectContaining({ eventType: 'OPEN_REQUEST_DETAIL_VIEWED' }),
      }),
    );
    expect(prisma.providerBookingRequestEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
        take: 2000,
        where: expect.objectContaining({
          eventType: { in: ['OPEN_REQUEST_DETAIL_HEARTBEAT', 'OPEN_REQUEST_DETAIL_CLOSED'] },
        }),
      }),
    );
  });
});

describe('AdminService operations calendar', () => {
  const calendarEvent = {
    allDay: false,
    authorId: 'ops@hands.vn',
    authorName: 'Ops Lead',
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    description: 'Watch the live booking board.',
    endAt: new Date('2026-07-01T10:00:00.000Z'),
    id: 'calendar-1',
    location: 'Operations room',
    startAt: new Date('2026-07-01T09:00:00.000Z'),
    tags: ['booking', 'handoff'],
    title: 'Morning booking watch',
    updatedAt: new Date('2026-07-01T08:05:00.000Z'),
    updatedById: 'ops@hands.vn',
    url: '',
  };

  it('lists calendar events with a bounded default limit and calendar response shape', async () => {
    const prisma = {
      adminCalendarEvent: {
        findMany: vi.fn().mockResolvedValue([calendarEvent]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listAdminCalendarEvents({ skip: '200', take: '500' })).resolves.toEqual([
      expect.objectContaining({
        authorId: 'ops@hands.vn',
        authorName: 'Ops Lead',
        end: '2026-07-01T10:00:00.000Z',
        id: 'calendar-1',
        start: '2026-07-01T09:00:00.000Z',
        tags: ['booking', 'handoff'],
        title: 'Morning booking watch',
      }),
    ]);
    expect(prisma.adminCalendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: 200,
        take: 200,
      }),
    );
  });

  it('creates calendar events for the current Admin Web operator identity', async () => {
    const prisma = {
      adminCalendarEvent: {
        create: vi.fn().mockResolvedValue(calendarEvent),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.createAdminCalendarEvent('admin-token-user', {
        allDay: false,
        end: '2026-07-01T10:00:00.000Z',
        operatorIdentity: 'ops@hands.vn',
        operatorName: 'Ops Lead',
        start: '2026-07-01T09:00:00.000Z',
        tags: ['booking', '#handoff'],
        title: 'Morning booking watch',
      }),
    ).resolves.toEqual(expect.objectContaining({ authorId: 'ops@hands.vn' }));
    expect(prisma.adminCalendarEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorId: 'ops@hands.vn',
          authorName: 'Ops Lead',
          tags: ['booking', 'handoff'],
          title: 'Morning booking watch',
        }),
      }),
    );
  });

  it('blocks calendar edits and deletes from a different operator identity', async () => {
    const prisma = {
      adminCalendarEvent: {
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(calendarEvent),
        update: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateAdminCalendarEvent('admin-token-user', 'calendar-1', {
        operatorIdentity: 'other@hands.vn',
        title: 'Hijacked event',
      }),
    ).rejects.toThrow('Only the calendar event author can update this event');
    await expect(
      service.deleteAdminCalendarEvent('admin-token-user', 'calendar-1', {
        operatorIdentity: 'other@hands.vn',
      }),
    ).rejects.toThrow('Only the calendar event author can delete this event');
    expect(prisma.adminCalendarEvent.update).not.toHaveBeenCalled();
    expect(prisma.adminCalendarEvent.delete).not.toHaveBeenCalled();
  });
});

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

  it('resolves admin operator access by session identity', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'operator-1',
          email: 'operator@hands.vn',
          fullName: 'Operator One',
          phone: '+84900000001',
          roles: [Role.ADMIN],
          adminOperatorPermission: {
            categories: [AdminOperatorPermissionCategory.BOOKINGS, AdminOperatorPermissionCategory.CUSTOMERS],
            updatedAt: new Date('2026-07-01T01:00:00.000Z'),
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getAdminOperatorAccess('admin-token-user', 'operator@hands.vn')).resolves.toEqual({
      categories: [AdminOperatorPermissionCategory.BOOKINGS, AdminOperatorPermissionCategory.CUSTOMERS],
      email: 'operator@hands.vn',
      fullName: 'Operator One',
      id: 'operator-1',
      phone: '+84900000001',
      roles: [Role.ADMIN],
      updatedAt: '2026-07-01T01:00:00.000Z',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'admin-token-user',
        roles: { has: Role.ADMIN },
        OR: [{ id: 'operator@hands.vn' }, { email: 'operator@hands.vn' }, { phone: 'operator@hands.vn' }],
      },
      select: expect.any(Object),
    });
  });

  it('falls back to role defaults when an existing master admin has no category row yet', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'master-admin-1',
          email: 'master@hands.vn',
          fullName: 'Master Admin',
          phone: '+84900000009',
          roles: [Role.ADMIN, Role.MASTER_ADMIN],
          adminOperatorPermission: null,
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.getAdminOperatorAccess('admin-token-user', 'master@hands.vn'),
    ).resolves.toMatchObject({
      categories: expect.arrayContaining([
        AdminOperatorPermissionCategory.BOOKINGS,
        AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
        AdminOperatorPermissionCategory.CUSTOMERS,
        AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY,
        AdminOperatorPermissionCategory.PARTNERS,
        AdminOperatorPermissionCategory.PARTNERS_DIRECTORY,
        AdminOperatorPermissionCategory.FINANCE,
        AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER,
        AdminOperatorPermissionCategory.NOTIFICATIONS,
        AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH,
        AdminOperatorPermissionCategory.SYSTEM,
        AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS,
      ]),
      email: 'master@hands.vn',
      id: 'master-admin-1',
      updatedAt: null,
    });
  });

  it('records admin web activity against the resolved operator identity', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'operator-1',
          email: 'operator@hands.vn',
          fullName: 'Operator One',
          phone: '+84900000001',
          roles: [Role.ADMIN],
          adminOperatorPermission: {
            categories: [AdminOperatorPermissionCategory.SYSTEM],
            updatedAt: new Date('2026-07-01T01:00:00.000Z'),
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.recordAdminOperatorActivity('admin-token-user', {
        action: 'admin_web.page_view',
        operatorIdentity: 'operator@hands.vn',
        target: 'admin_page:/admin-operators',
        metadata: { category: 'SYSTEM' },
      }),
    ).resolves.toEqual({ auditLog: { id: 'audit-1' }, ok: true });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'admin_web.page_view',
        actorId: 'operator-1',
        metadata: {
          category: 'SYSTEM',
          operatorIdentity: 'operator@hands.vn',
          requestedByAdminId: 'admin-token-user',
        },
        target: 'admin_page:/admin-operators',
      },
    });
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

  it('uses an admin-only lightweight projection for finance approver directories', async () => {
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listUsers({ role: Role.ADMIN, take: '50', view: 'finance-approver-directory' }),
    ).resolves.toEqual([]);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 50,
        where: { roles: { has: Role.ADMIN } },
      }),
    );
    const select = prisma.user.findMany.mock.calls[0][0].select;
    expect(select).toMatchObject({
      id: true,
      phone: true,
      email: true,
      fullName: true,
      roles: true,
      appSessions: expect.objectContaining({ take: 1 }),
      pushDevices: expect.objectContaining({ take: 3 }),
    });
    expect(select).not.toHaveProperty('adminOperatorPermission');
    expect(select).not.toHaveProperty('customerProfile');
    expect(select).not.toHaveProperty('providerProfile');
  });

  it('grants finance approver role only to admin users and audits the change', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'finance-admin-2',
          phone: '+84900000002',
          fullName: 'Finance Approver',
          roles: [Role.ADMIN],
        }),
        update: vi.fn().mockResolvedValue({
          id: 'finance-admin-2',
          phone: '+84900000002',
          fullName: 'Finance Approver',
          roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        }),
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
      (
        service as unknown as {
          updateUserFinanceApproverRole: (
            actorId: string,
            userId: string,
            input: { enabled: boolean; reason?: string },
          ) => Promise<unknown>;
        }
      ).updateUserFinanceApproverRole('admin-1', 'finance-admin-2', {
        enabled: true,
        reason: 'Treasury owner',
      }),
    ).resolves.toMatchObject({
      user: {
        id: 'finance-admin-2',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      },
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'finance-admin-2' },
      data: { roles: { set: [Role.ADMIN, Role.FINANCE_APPROVER] } },
      select: expect.any(Object),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'admin_user.finance_approver.grant',
        target: 'user:finance-admin-2',
        metadata: {
          enabled: true,
          reason: 'Treasury owner',
          previousRoles: [Role.ADMIN],
          nextRoles: [Role.ADMIN, Role.FINANCE_APPROVER],
        },
      },
    });
  });

  it('rejects finance approver role changes against the acting admin', async () => {
    const tx = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      (
        service as unknown as {
          updateUserFinanceApproverRole: (
            actorId: string,
            userId: string,
            input: { enabled: boolean; reason?: string },
          ) => Promise<unknown>;
        }
      ).updateUserFinanceApproverRole('admin-1', 'admin-1', {
        enabled: true,
        reason: 'Self grant',
      }),
    ).rejects.toThrow('Finance approver role changes cannot target the acting admin');

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects assigning finance approver role to non-admin users', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'customer-user-1',
          roles: [Role.CUSTOMER],
        }),
        update: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      (
        service as unknown as {
          updateUserFinanceApproverRole: (
            actorId: string,
            userId: string,
            input: { enabled: boolean; reason?: string },
          ) => Promise<unknown>;
        }
      ).updateUserFinanceApproverRole('admin-1', 'customer-user-1', {
        enabled: true,
      }),
    ).rejects.toThrow('Finance approver role can only be assigned to admin users');

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects revoking the last finance approver role', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'finance-admin-2',
          roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        }),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      (
        service as unknown as {
          updateUserFinanceApproverRole: (
            actorId: string,
            userId: string,
            input: { enabled: boolean; reason?: string },
          ) => Promise<unknown>;
        }
      ).updateUserFinanceApproverRole('admin-1', 'finance-admin-2', {
        enabled: false,
        reason: 'Rotation',
      }),
    ).rejects.toThrow('Cannot remove the last finance approver');

    expect(tx.user.count).toHaveBeenCalledWith({
      where: {
        id: { not: 'finance-admin-2' },
        roles: { has: Role.FINANCE_APPROVER },
      },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('creates the first master admin operator with email credentials and detailed category permissions', async () => {
    const tx = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'master-admin-2', roles: [Role.ADMIN, Role.MASTER_ADMIN] }),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(async (query: { where: { id?: string; phone?: string } }) => {
          if (query.where.id === 'admin-1') {
            return { id: 'admin-1', roles: [Role.ADMIN] };
          }
          if (query.where.id === 'master-admin-2') {
            return {
              id: 'master-admin-2',
              email: 'operator@hands.vn',
              phone: 'admin:operator',
              roles: [Role.ADMIN, Role.MASTER_ADMIN],
              adminOperatorPermission: {
                id: 'permission-1',
                categories: [AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS],
              },
            };
          }
          return null;
        }),
      },
      adminOperatorCredential: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'credential-1' }),
      },
      adminOperatorPermission: {
        upsert: vi.fn().mockResolvedValue({ id: 'permission-1' }),
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
      service.createAdminOperator('admin-1', {
        email: 'operator@hands.vn',
        fullName: 'Master Admin 2',
        password: 'initial-password',
        permissionCategories: [AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS],
        reason: 'Bootstrap first master',
        roles: [Role.MASTER_ADMIN],
      }),
    ).resolves.toMatchObject({
      user: {
        id: 'master-admin-2',
        roles: [Role.ADMIN, Role.MASTER_ADMIN],
      },
    });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: 'operator@hands.vn',
        fullName: 'Master Admin 2',
        phone: expect.stringMatching(/^admin:/u),
        roles: [Role.ADMIN, Role.MASTER_ADMIN],
      },
      select: expect.any(Object),
    });
    expect(tx.adminOperatorCredential.upsert).toHaveBeenCalledWith({
      where: { userId: 'master-admin-2' },
      create: {
        email: 'operator@hands.vn',
        passwordHash: expect.any(String),
        passwordSalt: expect.any(String),
        userId: 'master-admin-2',
      },
      update: {
        email: 'operator@hands.vn',
        passwordHash: expect.any(String),
        passwordSalt: expect.any(String),
      },
    });
    const allPermissionCategories = [
      AdminOperatorPermissionCategory.BOOKINGS,
      AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
      AdminOperatorPermissionCategory.BOOKINGS_IN_PROGRESS,
      AdminOperatorPermissionCategory.BOOKINGS_COMPLETED,
      AdminOperatorPermissionCategory.BOOKINGS_CANCELLATIONS,
      AdminOperatorPermissionCategory.BOOKINGS_DETAIL,
      AdminOperatorPermissionCategory.CUSTOMERS,
      AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY,
      AdminOperatorPermissionCategory.CUSTOMERS_DETAIL,
      AdminOperatorPermissionCategory.CUSTOMERS_REVIEWS,
      AdminOperatorPermissionCategory.PARTNERS,
      AdminOperatorPermissionCategory.PARTNERS_DIRECTORY,
      AdminOperatorPermissionCategory.PARTNERS_UNAPPROVED,
      AdminOperatorPermissionCategory.PARTNERS_DETAIL,
      AdminOperatorPermissionCategory.PARTNERS_KYC,
      AdminOperatorPermissionCategory.FINANCE,
      AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
      AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER,
      AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
      AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
      AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
      AdminOperatorPermissionCategory.FINANCE_TAX,
      AdminOperatorPermissionCategory.NOTIFICATIONS,
      AdminOperatorPermissionCategory.NOTIFICATIONS_TEMPLATES,
      AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH,
      AdminOperatorPermissionCategory.NOTIFICATIONS_DELIVERY,
      AdminOperatorPermissionCategory.SYSTEM,
      AdminOperatorPermissionCategory.SYSTEM_SERVICES,
      AdminOperatorPermissionCategory.SYSTEM_COUPONS,
      AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS,
      AdminOperatorPermissionCategory.SYSTEM_POLICY,
      AdminOperatorPermissionCategory.SYSTEM_AUDIT,
      AdminOperatorPermissionCategory.SYSTEM_SETUP,
    ];

    expect(tx.adminOperatorPermission.upsert).toHaveBeenCalledWith({
      where: { userId: 'master-admin-2' },
      create: {
        userId: 'master-admin-2',
        categories: { set: allPermissionCategories },
      },
      update: {
        categories: { set: allPermissionCategories },
      },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'admin_operator.create',
        target: 'user:master-admin-2',
        metadata: {
          permissionId: 'permission-1',
          previousRoles: [],
          nextRoles: [Role.ADMIN, Role.MASTER_ADMIN],
          permissionCategories: allPermissionCategories,
          reason: 'Bootstrap first master',
        },
      },
    });
  });

  it('requires an existing master admin once one has been bootstrapped', async () => {
    const tx = {
      user: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', roles: [Role.ADMIN] }),
      },
      adminOperatorPermission: { upsert: vi.fn() },
      adminAuditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createAdminOperator('admin-1', {
        email: 'operator@hands.vn',
        password: 'initial-password',
        phone: '+84900000009',
        roles: [Role.ADMIN],
      }),
    ).rejects.toThrow('Master Admin role is required for operator access changes');

    expect(tx.adminOperatorPermission.upsert).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('revokes admin operator access while preserving non-admin product roles', async () => {
    const tx = {
      user: {
        count: vi.fn().mockResolvedValue(2),
        findUnique: vi.fn(async (query: { where: { id?: string } }) => {
          if (query.where.id === 'master-admin-1') {
            return { id: 'master-admin-1', roles: [Role.ADMIN, Role.MASTER_ADMIN] };
          }
          if (query.where.id === 'operator-1') {
            return {
              id: 'operator-1',
              roles: [Role.CUSTOMER, Role.ADMIN, Role.FINANCE_APPROVER],
              adminOperatorPermission: {
                id: 'permission-1',
                categories: [AdminOperatorPermissionCategory.BOOKINGS],
              },
            };
          }
          return null;
        }),
        update: vi.fn().mockResolvedValue({ id: 'operator-1', roles: [Role.CUSTOMER] }),
      },
      adminOperatorPermission: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
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
      service.revokeAdminOperatorAccess('master-admin-1', 'operator-1', { reason: 'Role rotation' }),
    ).resolves.toMatchObject({
      ok: true,
      user: { id: 'operator-1', roles: [Role.CUSTOMER] },
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'operator-1' },
      data: { roles: { set: [Role.CUSTOMER] } },
      select: expect.any(Object),
    });
    expect(tx.adminOperatorPermission.deleteMany).toHaveBeenCalledWith({ where: { userId: 'operator-1' } });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'master-admin-1',
        action: 'admin_operator.access.revoke',
        target: 'user:operator-1',
        metadata: {
          permissionId: 'permission-1',
          previousRoles: [Role.CUSTOMER, Role.ADMIN, Role.FINANCE_APPROVER],
          nextRoles: [Role.CUSTOMER],
          previousPermissionCategories: [AdminOperatorPermissionCategory.BOOKINGS],
          reason: 'Role rotation',
        },
      },
    });
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
          OR: expect.arrayContaining([{ target: 'customer:customer-1' }, { target: 'user:user-1' }]),
        }),
      }),
    );
  });

  it('skips customer diagnostics selects and audit trail query when diagnostics are excluded', async () => {
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

    await expect(service.getCustomerDetail('customer-1', { includeDiagnostics: false })).resolves.toEqual({
      id: 'customer-1',
      userId: 'user-1',
    });

    expect(prisma.customerProfile.findUnique).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      select: expect.objectContaining({
        user: expect.objectContaining({
          select: expect.not.objectContaining({
            appSessions: expect.anything(),
            notifications: expect.anything(),
            pushDevices: expect.anything(),
          }),
        }),
      }),
    });
    expect(prisma.adminAuditLog.findMany).not.toHaveBeenCalled();
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
        count: vi
          .fn()
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(6),
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            { status: BookingStatus.OPEN_MATCHING, _count: { _all: 2 } },
            { status: BookingStatus.IN_SERVICE, _count: { _all: 3 } },
          ])
          .mockResolvedValueOnce([
            { status: BookingStatus.COMPLETED, _count: { _all: 7 } },
            { status: BookingStatus.CANCELLED, _count: { _all: 1 } },
          ]),
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
      $queryRaw: vi.fn().mockResolvedValueOnce([
        {
          activeBookingCustomers: 2n,
          liveActiveBookingCustomers: 2n,
          liveOpenMatchingCustomers: 1n,
        },
      ]),
    };
    const service = createAdminService(prisma);

    await expect(service.dashboardSummary('today')).resolves.toMatchObject({
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
      bookingActivity: {
        live: {
          active: 5,
          customerChoice: 4,
          inService: 3,
          openMatching: 2,
        },
        period: {
          cancelled: 1,
          completed: 7,
          total: 8,
        },
      },
      actionQueue: {
        completedPaymentHolds: 1,
        completedWithoutSettlement: 11,
        completedWithoutSettlementBacklog: 6,
        completedWithoutSettlementRecent: 5,
        customerChoice: 4,
        matchingExpired: 2,
        matchingWithoutParticipants: 3,
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
    expect(prisma.booking.groupBy).toHaveBeenNthCalledWith(1, {
      by: ['status'],
      _count: { _all: true },
      where: { status: { in: expect.any(Array) } },
    });
    expect(prisma.booking.groupBy).toHaveBeenNthCalledWith(2, {
      by: ['status'],
      _count: { _all: true },
      where: expect.any(Object),
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.OPEN_MATCHING,
        selectedProviderId: null,
        participants: {
          some: {
            status: { in: [ParticipantStatus.ACCEPTED, ParticipantStatus.SELECTED] },
          },
        },
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.OPEN_MATCHING,
        expiresAt: { lte: expect.any(Date) },
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.OPEN_MATCHING,
        participants: { none: {} },
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.COMPLETED,
        payment: { is: { status: PaymentStatus.AUTHORIZED } },
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.COMPLETED,
        settlementSnapshot: { is: null },
        OR: [
          { closedAt: { gte: expect.any(Date) } },
          { closedAt: null, updatedAt: { gte: expect.any(Date) } },
        ],
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.COMPLETED,
        settlementSnapshot: { is: null },
        OR: [{ closedAt: { lt: expect.any(Date) } }, { closedAt: null, updatedAt: { lt: expect.any(Date) } }],
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledTimes(6);
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

  it('aggregates Start Shift summaries while isolating a failed source', async () => {
    const service = createAdminService({});
    const dashboardSummary = vi
      .spyOn(service, 'dashboardSummary')
      .mockResolvedValue({ source: 'operations' } as never);
    const paymentSummary = vi
      .spyOn(service, 'paymentSummary')
      .mockResolvedValue({ source: 'payments' } as never);
    const earningsSummary = vi
      .spyOn(service, 'earningsSummary')
      .mockResolvedValue({ source: 'earnings' } as never);
    vi.spyOn(service, 'refundSummary').mockRejectedValue(new Error('refund summary unavailable'));
    const notificationSummary = vi
      .spyOn(service, 'notificationSummary')
      .mockResolvedValue({ source: 'notifications' } as never);
    const payoutBatchSummary = vi
      .spyOn(service, 'payoutBatchSummary')
      .mockResolvedValue({ source: 'payouts' } as never);
    const cashSettlementSummary = vi
      .spyOn(service, 'cashSettlementSummary')
      .mockResolvedValue({ source: 'cash' } as never);

    const result = await service.startShiftSummary('7d');

    expect(result).toMatchObject({
      cashSettlements: { source: 'cash' },
      earnings: { source: 'earnings' },
      notifications: { source: 'notifications' },
      operations: { source: 'operations' },
      payments: { source: 'payments' },
      payoutBatches: { source: 'payouts' },
      range: '7d',
      refunds: null,
      unavailableSources: ['refunds'],
    });
    expect(dashboardSummary).toHaveBeenCalledWith('7d');
    expect(paymentSummary).toHaveBeenCalledWith({ range: '7d' });
    expect(earningsSummary).toHaveBeenCalledWith({ range: '7d' });
    expect(payoutBatchSummary).toHaveBeenCalledWith({ range: '7d' });
    expect(cashSettlementSummary).toHaveBeenCalledWith({ range: '7d' });
    expect(notificationSummary).toHaveBeenCalledWith({
      from: expect.any(String),
      to: expect.any(String),
    });
    const notificationRange = notificationSummary.mock.calls[0]?.[0];
    expect(
      Date.parse(notificationRange?.to ?? '') - Date.parse(notificationRange?.from ?? ''),
    ).toBe(7 * 24 * 60 * 60 * 1000);
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
        aggregate: vi.fn().mockResolvedValue({ _sum: { viewCount: 0 } }),
      },
      customerProfile: {
        count: vi.fn().mockResolvedValue(0),
      },
      user: {
        count: vi.fn().mockResolvedValue(0),
      },
      payment: {
        groupBy: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      refund: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      review: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bookingService: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      massageService: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ count: 0 }]),
    };
    const service = createAdminService(prisma);

    await expect(service.getUsageOverview('7d')).resolves.toMatchObject({
      source: 'stored-usage-aggregates',
      range: '7d',
      customerLifecycle: {
        newCustomerCount: 0,
        activeCustomerCount: 0,
        activeTodayCustomerCount: 0,
        active7dCustomerCount: 0,
        active30dCustomerCount: 0,
        completedCustomerCount: 0,
        repeatCustomerCount: 0,
        churnRiskCustomerCount: 0,
        neverBookedCustomerCount: 0,
      },
      bookingQuality: {
        createdBookingCount: 0,
        cancellationCount: 0,
        refundCount: 0,
        lowReviewCount: 0,
      },
      paymentAndCoupon: {
        couponBookingCount: 0,
        paymentFailureCount: 0,
        refundAmount: 0,
        paymentMethodMix: [],
      },
      behavior: {
        popularServices: [],
        hourlyActivity: expect.arrayContaining([
          expect.objectContaining({
            hour: 0,
            label: '00:00',
            customerSessionCount: 0,
            bookingRequestCount: 0,
          }),
          expect.objectContaining({
            hour: 23,
            label: '23:00',
            customerSessionCount: 0,
            bookingRequestCount: 0,
          }),
        ]),
      },
      customerSegments: {
        newUnbookedCustomerCount: 0,
        firstCompletedCustomerCount: 0,
        repeatCustomerCount: 0,
        vipCustomerCount: 0,
        churnRiskCustomerCount: 0,
        issueCustomerCount: 0,
      },
      platformUsage: [],
      customerUsage: {
        qualityRiskCustomers: [],
        lowReviewCustomers: [],
      },
      partnerUsage: {
        discoveryConversion: [],
      },
    });

    expect(prisma.appSession.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['platform'],
        where: expect.objectContaining({ role: Role.CUSTOMER }),
        _count: { _all: true },
        orderBy: { _count: { platform: 'desc' } },
      }),
    );
    expect(prisma.appSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.booking.findMany.mock.calls.map(([query]) => query.take)).toEqual([100, 100]);
    expect(prisma.customerProviderProfileView.aggregate).toHaveBeenCalledWith({
      where: expect.any(Object),
      _sum: { viewCount: true },
    });
    expect(prisma.booking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['customerProfileId'],
        where: expect.objectContaining({
          status: {
            in: [
              BookingStatus.CANCELLED,
              BookingStatus.NO_SHOW,
              BookingStatus.EXPIRED,
              BookingStatus.REFUNDED,
            ],
          },
        }),
        _count: { _all: true },
        orderBy: { _count: { customerProfileId: 'desc' } },
        take: 10,
      }),
    );
    expect(prisma.review.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        rating: { lte: 2 },
        status: ReviewStatus.PUBLISHED,
        createdAt: expect.any(Object),
      }),
    });
    expect(prisma.review.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['customerProfileId'],
        where: expect.objectContaining({
          rating: { lte: 2 },
          status: ReviewStatus.PUBLISHED,
          createdAt: expect.any(Object),
        }),
        _count: { _all: true },
        _min: { rating: true },
        _max: { createdAt: true },
        orderBy: { _count: { customerProfileId: 'desc' } },
        take: 10,
      }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        roles: { has: Role.CUSTOMER },
        createdAt: expect.any(Object),
      }),
    });
    expect(prisma.customerProfile.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        user: expect.objectContaining({
          appSessions: {
            some: expect.objectContaining({
              role: Role.CUSTOMER,
              lastSeenAt: expect.any(Object),
            }),
          },
        }),
      }),
    });
    expect(prisma.customerProfile.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        bookings: { none: {} },
        user: expect.objectContaining({
          createdAt: expect.any(Object),
        }),
      }),
    });
    expect(prisma.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['method'],
        where: expect.objectContaining({
          booking: expect.objectContaining({
            status: BookingStatus.COMPLETED,
          }),
        }),
        _count: { _all: true },
        _sum: { amount: true },
      }),
    );
    expect(prisma.payment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: PaymentStatus.FAILED,
        booking: expect.objectContaining({
          createdAt: expect.any(Object),
        }),
      }),
    });
    expect(prisma.refund.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        createdAt: expect.any(Object),
      }),
      _sum: { amount: true },
    });
    expect((prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string })?.sql).toContain('::"Role"');
    expect((prisma.$queryRaw.mock.calls[1]?.[0] as { sql?: string })?.sql).toContain('::"BookingStatus"');
    expect((prisma.$queryRaw.mock.calls[2]?.[0] as { sql?: string })?.sql).toContain('::"BookingStatus"');
    expect((prisma.$queryRaw.mock.calls[3]?.[0] as { sql?: string })?.sql).toContain('HAVING COUNT(*) = 1');
    expect((prisma.$queryRaw.mock.calls[4]?.[0] as { sql?: string })?.sql).toContain('HAVING COUNT(*) >= 3');
    expect((prisma.$queryRaw.mock.calls[5]?.[0] as { sql?: string })?.sql).toContain(
      'COUNT(DISTINCT "customerProfileId")',
    );
  });

  it('filters chat archive rows server-side and returns only the latest message preview', async () => {
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
              messages: expect.objectContaining({
                orderBy: { createdAt: 'desc' },
                take: 1,
              }),
            }),
          },
        }),
        skip: 100,
        take: 50,
      }),
    );
  });

  it('allows the retained missing-room API filter without contradictory chat-room predicates', async () => {
    const prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listChatArchive({ status: 'missing-room' })).resolves.toEqual([]);

    const query = prisma.booking.findMany.mock.calls[0]?.[0] as {
      where: { AND: unknown[] };
    };
    expect(query.where.AND).toContainEqual({ chatRoom: { is: null } });
    expect(query.where.AND).not.toContainEqual({ chatRoom: { isNot: null } });
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
        count: vi.fn().mockResolvedValueOnce(120).mockResolvedValueOnce(70).mockResolvedValueOnce(50),
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
              { actor: { id: { contains: 'booking-1', mode: 'insensitive' } } },
              { actor: { email: { contains: 'booking-1', mode: 'insensitive' } } },
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
        count: vi
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1),
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

  it('skips booking audit diagnostics query when diagnostics are excluded', async () => {
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

    await expect(service.getBookingDetail('booking-1', { includeDiagnostics: false })).resolves.toEqual(
      expect.objectContaining({
        id: 'booking-1',
        matchingEvidence: expect.objectContaining({
          stage: 'CREATED',
        }),
      }),
    );

    expect(prisma.adminAuditLog.findMany).not.toHaveBeenCalled();
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
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([
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
    expect(prisma.customerSelectedLocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
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
        approvalAdminId: 'finance-admin-2',
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
          approvalAdminId: 'finance-admin-2',
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

  it('rejects referral reward cashout paid closeout without separate approval', async () => {
    const referrals = {
      payRewardCashout: vi.fn(),
    };
    const service = createAdminService({}, { referrals });

    await expect(
      service.markReferralRewardCashoutPaid('admin-1', 'reward-1', {
        reason: 'missing approval',
        transferRef: 'VCB-REF-001',
      }),
    ).rejects.toThrow('Referral reward cashout paid closeout requires approval from a different admin');

    await expect(
      service.markReferralRewardCashoutPaid('admin-1', 'reward-1', {
        approvalAdminId: 'admin-1',
        reason: 'same admin',
        transferRef: 'VCB-REF-001',
      } as never),
    ).rejects.toThrow('Referral reward cashout paid closeout requires approval from a different admin');

    expect(referrals.payRewardCashout).not.toHaveBeenCalled();
  });

  it('rejects referral reward cashout paid closeout approved by an admin without finance approver authority', async () => {
    const referrals = {
      payRewardCashout: vi.fn(),
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.markReferralRewardCashoutPaid('admin-1', 'reward-1', {
        approvalAdminId: 'support-user-2',
        reason: 'cashout transfer completed',
        transferRef: 'VCB-REF-001',
      }),
    ).rejects.toThrow('Referral reward cashout paid closeout requires approval from a finance approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(referrals.payRewardCashout).not.toHaveBeenCalled();
  });

  it('rejects referral reward cashout paid closeout without a transfer reference at the API boundary', async () => {
    const referrals = {
      payRewardCashout: vi.fn(),
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
    };
    const service = createAdminService(prisma, { referrals });

    await expect(
      service.markReferralRewardCashoutPaid('admin-1', 'reward-1', {
        approvalAdminId: 'finance-admin-2',
        reason: 'cashout transfer completed',
        transferRef: '   ',
      }),
    ).rejects.toThrow('Referral cashout paid closeout requires a transfer reference');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'finance-admin-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(referrals.payRewardCashout).not.toHaveBeenCalled();
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
      payment: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'payment-1', status: PaymentStatus.CAPTURED }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
                {
                  referralCodes: {
                    some: {
                      audience: ReferralAudience.CUSTOMER,
                      code: { contains: 'Parent', mode: 'insensitive' },
                    },
                  },
                },
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
          helper:
            'Customer referral rewards credit to the customer wallet; bank cashout details are not collected in MVP.',
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
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
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
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
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
            user: {
              appSessions: [
                {
                  lastSeenAt: now,
                },
              ],
            },
          },
        ]),
      },
      booking: {
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(0),
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
      payment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const service = createAdminService(prisma);

    const overview = await service.getVietnamOverview('today');
    const hcm = overview.regions.find((region) => region.regionCode === 'hcm');
    const serialized = JSON.stringify(overview);

    expect(overview).toMatchObject({
      regionalSampleLimit: 50,
      refreshSeconds: 60,
      source: 'stored-address-aggregates',
      totals: {
        activeBookingCount: 1,
        activeCustomerCount: 1,
        cancellationCount: 0,
        completedBookingCount: 1,
        customerCount: 1,
        onlinePartnerCount: 1,
        partnerCount: 1,
      },
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
          kind: 'customers',
          latitude: 10.7769,
          longitude: 106.7009,
          customerProfileId: 'customer-1',
        }),
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
      'customers',
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
        count: vi.fn().mockResolvedValueOnce(320).mockResolvedValueOnce(80),
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
        count: vi.fn().mockResolvedValueOnce(140).mockResolvedValueOnce(45),
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
            user: {
              appSessions: [
                {
                  lastSeenAt: now,
                },
              ],
            },
          },
        ]),
      },
      booking: {
        count: vi.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(90).mockResolvedValueOnce(4),
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      payment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 12_500_000 } }),
      },
    };
    const service = createAdminService(prisma);

    const summary = await service.getVietnamOverviewSummary('today');

    expect(summary).not.toHaveProperty('points');
    expect(summary).not.toHaveProperty('realtimePoints');
    expect(summary.totals).toMatchObject({
      activeBookingCount: 12,
      activeCustomerCount: 80,
      cancellationCount: 4,
      completedBookingCount: 90,
      customerCount: 320,
      onlinePartnerCount: 45,
      partnerCount: 140,
      revenueAmount: 12_500_000,
    });
    expect(summary.regionalSampleLimit).toBe(50);
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
    expect(prisma.customerProfile.findMany.mock.calls[0][0]).not.toHaveProperty('where');
    expect(prisma.providerProfile.findMany.mock.calls[0][0]).not.toHaveProperty('where');
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

  it('keeps all saved customer locations on the realtime map while only fresh sessions count as active', async () => {
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

    expect(pointFeed.realtimePoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerProfileId: 'fresh-customer',
          kind: 'customers',
        }),
        expect.objectContaining({
          customerProfileId: 'fresh-customer',
          kind: 'active',
        }),
        expect.objectContaining({
          customerProfileId: 'stale-customer',
          kind: 'customers',
        }),
      ]),
    );
    expect(pointFeed.realtimePoints).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerProfileId: 'stale-customer',
          kind: 'active',
        }),
      ]),
    );
  });

  it('classifies partner map dots as ready, stale, or offline from stored status and last app session', async () => {
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const prisma = {
      customerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([
          providerMapFixture({
            id: 'ready-partner',
            status: ProviderStatus.ONLINE_AVAILABLE,
            user: { appSessions: [{ lastSeenAt: now }] },
          }),
          providerMapFixture({
            id: 'stale-partner',
            status: ProviderStatus.ONLINE_AVAILABLE,
            user: { appSessions: [{ lastSeenAt: eightDaysAgo }] },
          }),
          providerMapFixture({
            id: 'busy-partner',
            status: ProviderStatus.ONLINE_BUSY,
            user: { appSessions: [{ lastSeenAt: now }] },
          }),
          providerMapFixture({
            id: 'manual-off-partner',
            status: ProviderStatus.OFFLINE,
            user: { appSessions: [{ lastSeenAt: now }] },
          }),
        ]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    const pointFeed = await service.getVietnamOverviewRealtimePoints('today');

    expect(pointFeed.realtimePoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'online', providerProfileId: 'ready-partner' }),
        expect.objectContaining({ kind: 'stale-partners', providerProfileId: 'stale-partner' }),
        expect.objectContaining({ kind: 'offline-partners', providerProfileId: 'busy-partner' }),
        expect.objectContaining({ kind: 'offline-partners', providerProfileId: 'manual-off-partner' }),
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
        AND: [{ bankAccounts: { some: {} } }, { bankAccounts: { none: { status: 'APPROVED' } } }],
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
          {
            preferredBookings: {
              some: {
                status: {
                  in: ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'],
                },
              },
            },
          },
          {
            selectedBookings: {
              some: {
                status: {
                  in: ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'],
                },
              },
            },
          },
          {
            participants: {
              some: {
                booking: {
                  status: {
                    in: [
                      'CREATED',
                      'OPEN_MATCHING',
                      'MATCHED',
                      'PROVIDER_ON_THE_WAY',
                      'ARRIVED',
                      'IN_SERVICE',
                    ],
                  },
                },
              },
            },
          },
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
          {
            preferredBookings: {
              some: {
                status: { in: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'] },
                chatRoom: { is: null },
              },
            },
          },
          {
            selectedBookings: {
              some: {
                status: { in: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'] },
                chatRoom: { is: null },
              },
            },
          },
          {
            participants: {
              some: {
                booking: {
                  status: { in: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'] },
                  chatRoom: { is: null },
                },
              },
            },
          },
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
    expect(select.sessions).toBeUndefined();
    expect(select.devices).toBeUndefined();
    expect(select.user.select.pushDevices).toBeUndefined();
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

  it('paginates file review rows directly and returns only compact Partner identity', async () => {
    const prisma = {
      fileAsset: {
        findMany: vi.fn().mockResolvedValue([
          {
            contentType: 'image/jpeg',
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
            id: 'file-public-1',
            key: 'partners/linh/gallery.jpg',
            owner: {
              providerProfile: {
                displayName: 'Linh Partner',
                id: 'partner-1',
                status: 'ONLINE_AVAILABLE',
                user: {
                  fullName: 'Linh',
                  id: 'user-1',
                  phone: '+84900000000',
                },
              },
            },
            providerVerification: null,
            providerVerificationId: null,
            purpose: 'PROVIDER_GALLERY',
            reviewReason: null,
            reviewStatus: 'PENDING_REVIEW',
            sizeBytes: 1024,
            uploadedAt: new Date('2026-07-01T00:00:00.000Z'),
            uploadStatus: 'UPLOADED',
            url: 'https://cdn.example.test/gallery.jpg',
            visibility: 'PUBLIC',
          },
        ]),
        count: vi.fn().mockResolvedValue(11),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listFileReviewItems({
        kind: 'public-media',
        q: 'gallery',
        review: 'needs-review',
        skip: '10',
        take: '10',
      }),
    ).resolves.toEqual({
      rows: [
        expect.objectContaining({
          id: 'file-public-1',
          kind: 'public-media',
          partner: {
            displayName: 'Linh Partner',
            id: 'partner-1',
            status: 'ONLINE_AVAILABLE',
            userFullName: 'Linh',
            userId: 'user-1',
            userPhone: '+84900000000',
          },
          url: 'https://cdn.example.test/gallery.jpg',
        }),
      ],
      totalCount: 11,
    });

    const query = prisma.fileAsset.findMany.mock.calls[0][0];
    expect(query).toEqual(expect.objectContaining({ skip: 10, take: 10 }));
    expect(JSON.stringify(query.where)).toContain('gallery');
    expect(JSON.stringify(query.where)).toContain('PENDING_REVIEW');
    expect(query.select.owner.select.providerProfile.select.user.select).toEqual({
      fullName: true,
      id: true,
      phone: true,
    });
    expect(query.select.owner.select.providerProfile.select.user.select.pushDevices).toBeUndefined();
  });

  it('never returns a stored private file URL from the compact review list', async () => {
    const prisma = {
      fileAsset: {
        findMany: vi.fn().mockResolvedValue([
          {
            contentType: 'image/jpeg',
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
            id: 'file-private-1',
            key: 'private/partner-1/identity.jpg',
            owner: null,
            providerVerification: {
              providerProfile: {
                displayName: 'Private Partner',
                id: 'partner-1',
                status: 'OFFLINE',
                user: { fullName: null, id: 'user-1', phone: '+84900000000' },
              },
            },
            providerVerificationId: 'verification-1',
            purpose: 'PROVIDER_VERIFICATION',
            reviewReason: null,
            reviewStatus: 'PENDING_REVIEW',
            sizeBytes: 2048,
            uploadedAt: new Date('2026-07-01T00:00:00.000Z'),
            uploadStatus: 'UPLOADED',
            url: 'https://private.example.test/identity.jpg',
            visibility: 'PRIVATE',
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = createAdminService(prisma);

    const result = await service.listFileReviewItems({ kind: 'private-verification', take: '10' });

    expect(result.rows[0]).toEqual(expect.objectContaining({ kind: 'private-verification', url: null }));
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
        count: vi.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(7),
      },
      providerSanction: {
        count: vi.fn().mockResolvedValue(3),
      },
      providerProfile: {
        count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(4).mockResolvedValueOnce(5),
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
        findMany: vi
          .fn()
          .mockResolvedValue([{ providerProfileId: 'provider-1' }, { providerProfileId: 'provider-2' }]),
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

  it('hydrates bounded partner detail payout batches with maker and approver identities', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          devices: [],
          id: 'provider-1',
          payoutBatches: [
            {
              id: 'payout-1',
              status: PayoutBatchStatus.PAID,
              totalNetAmount: 500000,
            },
          ],
          sessions: [],
        }),
      },
      adminAuditLog: {
        findMany: vi.fn().mockImplementation((args: { where?: { action?: unknown } }) => {
          if (args.where?.action) {
            return Promise.resolve([
              {
                action: 'payout_batch.update',
                actorId: 'finance-maker-1',
                metadata: {
                  approvalAdminId: 'finance-approver-2',
                  status: PayoutBatchStatus.PAID,
                },
                target: 'payout_batch:payout-1',
              },
              {
                action: 'payout_batch.create',
                actorId: 'finance-creator-1',
                metadata: {},
                target: 'payout_batch:payout-1',
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { email: 'creator@hands.vn', fullName: 'Finance Creator', id: 'finance-creator-1' },
          { email: 'maker@hands.vn', fullName: 'Finance Maker', id: 'finance-maker-1' },
          { email: 'approver@hands.vn', fullName: 'Finance Approver', id: 'finance-approver-2' },
        ]),
      },
    };
    const service = createAdminService(prisma);

    const detail = await service.getProviderDetail('provider-1');

    expect(detail.payoutBatches).toEqual([
      expect.objectContaining({
        approvalAdmin: expect.objectContaining({ fullName: 'Finance Approver' }),
        approvalAdminId: 'finance-approver-2',
        createdBy: expect.objectContaining({ fullName: 'Finance Creator' }),
        paidBy: expect.objectContaining({ fullName: 'Finance Maker' }),
        paidByAdminId: 'finance-maker-1',
      }),
    ]);
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: { in: ['payout_batch.create', 'payout_batch.update'] },
        target: { in: ['payout_batch:payout-1'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { action: true, actorId: true, metadata: true, target: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
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

  it('omits partner detail device diagnostics and shared-device lookup when not requested', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerDevice: {
        findMany: vi.fn(),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getProviderDetail('provider-1', { includeDiagnostics: false })).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [],
        sharedDeviceMatches: [],
      }),
    );

    expect(prisma.providerProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          devices: expect.anything(),
          sessions: expect.anything(),
        }),
      }),
    );
    expect(prisma.providerDevice.findMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalled();
  });

  it('loads only partner finance evidence and skips the general audit trail for the finance view', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'provider-1',
          payoutBatches: [],
        }),
      },
      providerDevice: {
        findMany: vi.fn(),
      },
      adminAuditLog: {
        findMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.getProviderDetail('provider-1', { includeDiagnostics: false, view: 'finance' }),
    ).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [],
        sharedDeviceMatches: [],
      }),
    );

    expect(prisma.providerProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          bankAccounts: expect.any(Object),
          earnings: expect.any(Object),
          payoutBatches: expect.any(Object),
          taxProfile: expect.any(Object),
        }),
      }),
    );
    const select = prisma.providerProfile.findUnique.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty('documents');
    expect(select).not.toHaveProperty('preferredBookings');
    expect(select).not.toHaveProperty('selectedBookings');
    expect(select).not.toHaveProperty('devices');
    expect(select).not.toHaveProperty('sessions');
    expect(prisma.providerDevice.findMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.findMany).not.toHaveBeenCalled();
  });

  it('loads only partner approval evidence and skips money, booking, and audit relations', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerDevice: {
        findMany: vi.fn(),
      },
      adminAuditLog: {
        findMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.getProviderDetail('provider-1', { includeDiagnostics: false, view: 'evidence' }),
    ).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [],
        sharedDeviceMatches: [],
      }),
    );

    const select = prisma.providerProfile.findUnique.mock.calls[0]?.[0]?.select;
    expect(select).toEqual(
      expect.objectContaining({
        agreements: expect.any(Object),
        documents: expect.any(Object),
        locationSnapshots: expect.any(Object),
        services: expect.any(Object),
        verification: expect.any(Object),
        verificationLogs: expect.any(Object),
      }),
    );
    expect(select).not.toHaveProperty('earnings');
    expect(select).not.toHaveProperty('payoutBatches');
    expect(select).not.toHaveProperty('preferredBookings');
    expect(select).not.toHaveProperty('selectedBookings');
    expect(select).not.toHaveProperty('participants');
    expect(select).not.toHaveProperty('devices');
    expect(select).not.toHaveProperty('sessions');
    expect(prisma.providerDevice.findMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.findMany).not.toHaveBeenCalled();
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
      generatedAt: expect.any(String),
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
      completedCount: 6,
      generatedAt: expect.any(String),
      needsUpdateCount: 5,
      openCount: 10,
      outcomeLinkedCount: 4,
      refundedBookingCount: 3,
      requestedCount: 8,
      totalCount: 24,
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

  it('persists a partner bank deposit request without writing wallet or GL entries', async () => {
    const request = {
      id: 'deposit-request-1',
      providerProfileId: 'provider-1',
      amount: 1000000,
      currency: 'VND',
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: new Date('2026-06-29T09:30:00.000Z'),
      requestedBeforeBalance: -170000,
      requestedAfterBalance: 830000,
      requestedReceivableRecovery: 170000,
      requestedWalletLiabilityIncrease: 830000,
    };
    const tx = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }) },
      providerWalletLedgerEntry: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -170000 } }),
      },
      partnerBankDepositRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(request),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = { ...tx, $transaction: vi.fn((callback) => callback(tx)) };
    const earnings = { recordPartnerBankDeposit: vi.fn() };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.createPartnerBankDepositRequest('maker-admin', {
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
      }),
    ).resolves.toEqual(request);

    expect(tx.partnerBankDepositRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestedByAdminId: 'maker-admin',
        requestedBeforeBalance: -170000,
        requestedAfterBalance: 830000,
        requestedReceivableRecovery: 170000,
        requestedWalletLiabilityIncrease: 830000,
      }),
    });
    expect(earnings.recordPartnerBankDeposit).not.toHaveBeenCalled();
  });

  it('returns a conflict when concurrent makers reuse the same Partner bank reference', async () => {
    const duplicateError = new Prisma.PrismaClientKnownRequestError('Duplicate bank reference', {
      clientVersion: '6.19.3',
      code: 'P2002',
    });
    const prisma = { $transaction: vi.fn().mockRejectedValue(duplicateError) };
    const service = createAdminService(prisma);

    await expect(
      service.createPartnerBankDepositRequest('maker-admin', {
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
      }),
    ).rejects.toThrow(
      'A partner bank deposit request already exists for this Partner and bank reference',
    );
  });

  it('executes an approved partner bank deposit into wallet, balanced GL, and audit atomically', async () => {
    const request = {
      id: 'deposit-request-1',
      providerProfileId: 'provider-1',
      amount: 1000000,
      currency: 'VND',
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: new Date('2026-06-29T09:30:00.000Z'),
      bankAccount: 'BIDV 123456789',
      attachmentFileId: 'file-deposit-proof-1',
      attachmentUrl: null,
      notes: 'Confirmed',
      requestedByAdminId: 'maker-admin',
      status: PartnerBankDepositRequestStatus.REQUESTED,
    };
    const ledger = {
      id: 'wallet-deposit-1',
      providerProfileId: 'provider-1',
      amount: 1000000,
      currency: 'VND',
      reference: 'BIDV-20260629-001',
      sourceKey: 'partner-bank-deposit:provider-1:BIDV-20260629-001',
      metadata: {
        allocation: {
          currentWalletBalance: -170000,
          currentNegativeWalletAmount: 170000,
          depositAmount: 1000000,
          amountAppliedToNegativeWallet: 170000,
          amountCreditedToWalletLiability: 830000,
          resultingWalletBalance: 830000,
        },
      },
    };
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'approver-admin' }) },
      partnerBankDepositRequest: {
        findUnique: vi.fn().mockResolvedValue(request),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ ...request, status: PartnerBankDepositRequestStatus.EXECUTED }),
      },
      accountingJournalBatch: { upsert: vi.fn().mockResolvedValue({ id: 'journal-1' }) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = { ...tx, $transaction: vi.fn((callback) => callback(tx)) };
    const earnings = { recordPartnerBankDeposit: vi.fn().mockResolvedValue(ledger) };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.approvePartnerBankDepositRequest('approver-admin', 'deposit-request-1'),
    ).resolves.toMatchObject({
      ledger: { id: 'wallet-deposit-1' },
      journal: { id: 'journal-1' },
      allocation: {
        amountAppliedToNegativeWallet: 170000,
        amountCreditedToWalletLiability: 830000,
      },
    });

    expect(earnings.recordPartnerBankDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: 'approver-admin', providerProfileId: 'provider-1' }),
      tx,
    );
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ totalDebit: 1000000, totalCredit: 1000000 }),
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(2);
  });

  it('allocates approved deposit receivable recovery to cash debt without another wallet or GL entry', async () => {
    const request = {
      id: 'deposit-request-1',
      providerProfileId: 'provider-1',
      currency: 'VND',
      bankTransactionId: 'BIDV-20260629-001',
      requestedReceivableRecovery: 170000,
      ledgerEntryId: 'wallet-deposit-1',
      journalBatchId: 'journal-1',
      status: PartnerBankDepositRequestStatus.EXECUTED,
    };
    const earning = {
      id: 'earning-1',
      providerProfileId: 'provider-1',
      bookingId: 'booking-1',
      netAmount: -170000,
      currency: 'VND',
      status: EarningStatus.PENDING,
    };
    const allocation = {
      id: 'allocation-1',
      partnerBankDepositRequestId: request.id,
      providerEarningId: earning.id,
      amount: 170000,
      currency: 'VND',
      allocatedByAdminId: 'finance-admin',
    };
    const tx = {
      partnerBankDepositRequest: { findUnique: vi.fn().mockResolvedValue(request) },
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(earning),
        update: vi.fn().mockResolvedValue({ ...earning, status: EarningStatus.PAID }),
      },
      partnerBankDepositCashDebtAllocation: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn().mockResolvedValue(allocation),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = { ...tx, $transaction: vi.fn((callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.allocatePartnerBankDepositCashDebt('finance-admin', request.id, {
        earningId: earning.id,
        amount: 170000,
        notes: 'Bank evidence allocated',
      }),
    ).resolves.toMatchObject({
      allocation: { id: 'allocation-1' },
      cashDebtFullyAllocated: true,
      remainingDebtAmount: 0,
      remainingReceivableRecovery: 0,
    });

    expect(tx.providerEarning.update).toHaveBeenCalledWith({
      where: { id: earning.id },
      data: expect.objectContaining({
        status: EarningStatus.PAID,
        settlementMethod: 'PARTNER_DEPOSIT',
        settlementRef: request.bankTransactionId,
      }),
    });
    expect(tx).not.toHaveProperty('providerWalletLedgerEntry');
    expect(tx).not.toHaveProperty('accountingJournalBatch');
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'partner_bank_deposit.cash_debt_allocate',
        metadata: expect.objectContaining({
          notes: 'Bank evidence allocated',
          createsWalletLedgerEntry: false,
          createsAccountingJournalEntry: false,
        }),
      }),
    });
  });

  it('rejects Partner deposit cash-debt allocation without a sufficient audit reason', async () => {
    const transaction = vi.fn();
    const service = createAdminService({ $transaction: transaction });

    await expect(
      service.allocatePartnerBankDepositCashDebt('finance-admin', 'deposit-request-1', {
        earningId: 'earning-1',
        amount: 170000,
        notes: 'too short',
      }),
    ).rejects.toThrow('Cash debt allocation requires an audit reason of at least 12 characters');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('keeps partially allocated cash debt open and rejects allocation beyond deposit recovery', async () => {
    const request = {
      id: 'deposit-request-1',
      providerProfileId: 'provider-1',
      currency: 'VND',
      bankTransactionId: 'BIDV-20260629-001',
      requestedReceivableRecovery: 100000,
      ledgerEntryId: 'wallet-deposit-1',
      journalBatchId: 'journal-1',
      status: PartnerBankDepositRequestStatus.EXECUTED,
    };
    const earning = {
      id: 'earning-1',
      providerProfileId: 'provider-1',
      bookingId: 'booking-1',
      netAmount: -170000,
      currency: 'VND',
      status: EarningStatus.PENDING,
    };
    const tx = {
      partnerBankDepositRequest: { findUnique: vi.fn().mockResolvedValue(request) },
      providerEarning: { findUnique: vi.fn().mockResolvedValue(earning), update: vi.fn() },
      partnerBankDepositCashDebtAllocation: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn().mockResolvedValue({ id: 'allocation-1', amount: 70000, currency: 'VND' }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = createAdminService({ ...tx, $transaction: vi.fn((callback) => callback(tx)) });

    await expect(
      service.allocatePartnerBankDepositCashDebt('finance-admin', request.id, {
        earningId: earning.id,
        amount: 70000,
        notes: 'Allocate partial bank evidence',
      }),
    ).resolves.toMatchObject({ cashDebtFullyAllocated: false, remainingDebtAmount: 100000 });
    expect(tx.providerEarning.update).not.toHaveBeenCalled();

    await expect(
      service.allocatePartnerBankDepositCashDebt('finance-admin', request.id, {
        earningId: earning.id,
        amount: 100001,
        notes: 'Allocation exceeds approved recovery',
      }),
    ).rejects.toThrow('Allocation exceeds the deposit receivable recovery remaining');
  });

  it('paginates the Partner deposit reconciliation queue and reports the remaining bank evidence amount', async () => {
    const request = {
      id: 'deposit-request-1',
      providerProfileId: 'provider-1',
      amount: 200000,
      currency: 'VND',
      bankTransactionId: 'VCB-20260629-001',
      depositDate: new Date('2026-06-29T04:00:00.000Z'),
      requestedReceivableRecovery: 100000,
      status: PartnerBankDepositRequestStatus.EXECUTED,
      journalBatchId: 'journal-1',
      executedAt: new Date(Date.now() - 6 * 60 * 60_000),
      createdAt: new Date(Date.now() - 7 * 60 * 60_000),
      requestedByAdminId: 'maker-admin',
      approvedByAdminId: 'approver-admin',
      rejectedByAdminId: null,
      cashDebtAllocations: [{ amount: 70000 }],
      providerProfile: {
        id: 'provider-1',
        displayName: 'Partner One',
        user: { id: 'user-1', fullName: 'Partner One', email: null, phone: '+84900000001' },
      },
    };
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ openAmount: 150000n, openCount: 1n }])
        .mockResolvedValueOnce([{ id: request.id }]),
      partnerBankDepositRequest: {
        findMany: vi.fn().mockResolvedValue([request]),
        groupBy: vi.fn().mockResolvedValue([
          { status: PartnerBankDepositRequestStatus.EXECUTED, _count: { _all: 1 } },
        ]),
      },
      accountingJournalEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            batchId: 'journal-1',
            amount: 200000,
            bankReconciliationMatches: [{ amount: 50000 }],
          },
        ]),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'deposit-assignment-1',
          actorId: 'master-admin',
          createdAt: new Date('2026-07-14T05:00:00.000Z'),
          metadata: {
            assigneeAdminId: 'finance-operator',
            assignedAt: '2026-07-14T05:00:00.000Z',
            assignedByAdminId: 'master-admin',
            reason: 'Own overdue deposit evidence',
          },
          target: `partner_bank_deposit_request:${request.id}`,
          actor: { id: 'master-admin', email: 'master@hands.test', fullName: 'Master Admin' },
        }]),
      },
      user: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { id: 'maker-admin', email: 'maker@hands.test', fullName: 'Deposit Maker' },
            { id: 'approver-admin', email: 'approver@hands.test', fullName: 'Finance Approver' },
          ])
          .mockResolvedValueOnce([
            { id: 'finance-operator', email: 'operator@hands.test', fullName: 'Finance Operator' },
            { id: 'master-admin', email: 'master@hands.test', fullName: 'Master Admin' },
          ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listPartnerBankDepositRequestHistory({
        period: '2026-06',
        review: 'needs-reconciliation',
        skip: 0,
        take: 25,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: request.id,
          allocatedCashDebtAmount: 70000,
          reconciliationMatchedAmount: 50000,
          reconciliationRemainingAmount: 150000,
          reconciliationReviewAssignment: {
            assigneeAdminId: 'finance-operator',
            assignee: { fullName: 'Finance Operator' },
          },
          reconciliationSlaStatus: 'WITHIN_24H',
          reconciliationWaitingHours: expect.any(Number),
          reconciliationStatus: 'PARTIALLY_MATCHED',
          requestedBy: { fullName: 'Deposit Maker' },
          approvedBy: { fullName: 'Finance Approver' },
          rejectedBy: null,
        },
      ],
      pagination: { skip: 0, take: 25, total: 1 },
      reconciliationSummary: { openAmount: 150000, openCount: 1, period: '2026-06' },
    });

    expect(prisma.partnerBankDepositRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [request.id] } } }),
    );
    expect(prisma.accountingJournalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ batchId: { in: ['journal-1'] } }),
      }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
  });

  it('filters Partner deposit reconciliation ownership and SLA before pagination', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      partnerBankDepositRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      accountingJournalEntry: { findMany: vi.fn().mockResolvedValue([]) },
      adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = createAdminService(prisma);

    await expect(service.listPartnerBankDepositRequestHistory({
      assigneeAdminId: 'finance-operator-1',
      review: 'needs-reconciliation',
      sla: 'escalate',
      skip: 0,
      take: 25,
    })).resolves.toMatchObject({
      items: [],
      pagination: { skip: 0, take: 25, total: 0 },
    });

    const queries = prisma.$queryRaw.mock.calls.map((call) => call[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    });
    const queryText = queries.map((query) => query.sql ?? query.text ?? '').join('\n');
    const queryValues = queries.flatMap((query) => query.values ?? []);
    expect(queryText).toContain('latestPartnerBankDepositAssignments');
    expect(queryText).toContain('assigneeAdminId');
    expect(queryText).toContain("INTERVAL '48 hours'");
    expect(queryValues).toContain('finance-operator-1');
    expect(queryValues).toContain('escalate');
    expect(queryText).toContain('LIMIT');
    expect(queryText).toContain('OFFSET');
  });

  it('rejects Partner deposit owner filters outside the reconciliation queue', async () => {
    const prisma = {
      partnerBankDepositRequest: { groupBy: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const service = createAdminService(prisma);

    await expect(service.listPartnerBankDepositRequestHistory({
      owner: 'unassigned',
      review: 'all',
    })).rejects.toThrow(
      'Partner bank deposit owner and SLA filters require needs-reconciliation review',
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('hydrates deposit request and cash-debt allocation operators in the detail response', async () => {
    const request = {
      id: 'deposit-request-detail',
      providerProfileId: 'provider-1',
      requestedByAdminId: 'maker-admin',
      approvedByAdminId: 'approver-admin',
      rejectedByAdminId: null,
      ledgerEntryId: null,
      journalBatchId: null,
      requestedReceivableRecovery: 100000,
      providerProfile: {
        id: 'provider-1',
        displayName: 'Partner One',
        user: { id: 'partner-user', fullName: 'Partner One', email: null, phone: '+84900000001' },
      },
      cashDebtAllocations: [
        {
          id: 'allocation-1',
          amount: 40000,
          allocatedByAdminId: 'allocator-admin',
          providerEarning: { id: 'earning-1' },
        },
      ],
    };
    const prisma = {
      partnerBankDepositRequest: { findUnique: vi.fn().mockResolvedValue(request) },
      providerEarning: { findMany: vi.fn().mockResolvedValue([]) },
      adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'maker-admin', email: 'maker@hands.test', fullName: 'Deposit Maker' },
          { id: 'approver-admin', email: 'approver@hands.test', fullName: 'Finance Approver' },
          { id: 'allocator-admin', email: 'allocator@hands.test', fullName: 'Debt Allocator' },
        ]),
      },
    };
    const service = createAdminService(prisma);

    const detail = await service.getPartnerBankDepositRequestDetail(request.id);

    expect(detail).toMatchObject({
      request: {
        requestedBy: { fullName: 'Deposit Maker' },
        approvedBy: { fullName: 'Finance Approver' },
        rejectedBy: null,
      },
      allocatedCashDebtAmount: 40000,
      remainingReceivableRecovery: 60000,
    });
    expect(detail.request.cashDebtAllocations).toHaveLength(1);
    expect(detail.request.cashDebtAllocations[0]).toMatchObject({
      allocatedBy: { fullName: 'Debt Allocator' },
    });
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('blocks direct Partner deposit mark-paid so deposit accounting cannot be posted twice', async () => {
    const earnings = { markPaid: vi.fn() };
    const service = createAdminService({}, { earnings });

    await expect(
      service.markEarningPaid('admin-1', 'earning-1', {
        settlementMethod: 'PARTNER_DEPOSIT',
        settlementRef: 'BANK-001',
      }),
    ).rejects.toThrow('Approved Partner deposits must be allocated from the deposit request detail');
    expect(earnings.markPaid).not.toHaveBeenCalled();
  });

  it('blocks maker self-approval before writing partner wallet or GL entries', async () => {
    const request = {
      id: 'deposit-request-1',
      requestedByAdminId: 'maker-admin',
      status: PartnerBankDepositRequestStatus.REQUESTED,
    };
    const tx = {
      partnerBankDepositRequest: { findUnique: vi.fn().mockResolvedValue(request) },
      accountingJournalBatch: { upsert: vi.fn() },
    };
    const prisma = { ...tx, $transaction: vi.fn((callback) => callback(tx)) };
    const earnings = { recordPartnerBankDeposit: vi.fn() };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.approvePartnerBankDepositRequest('maker-admin', 'deposit-request-1'),
    ).rejects.toThrow('Partner bank deposit requires approval from a different admin');
    expect(earnings.recordPartnerBankDeposit).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).not.toHaveBeenCalled();
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

  it('persists a manual wallet adjustment request without writing wallet or accounting ledgers', async () => {
    const request = {
      id: 'wallet-request-1',
      ownerType: 'PARTNER',
      ownerId: 'provider-1',
      direction: 'CREDIT',
      adjustmentType: 'PARTNER_BONUS',
      amount: 200000,
      currency: 'VND',
      reason: 'Partner recovery bonus',
      requestedBeforeBalance: 0,
      requestedAfterBalance: 200000,
      requiresAttachment: false,
    };
    const tx = {
      providerProfile: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'provider-1' }) },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn(),
      },
      manualWalletAdjustmentRequest: { create: vi.fn().mockResolvedValue(request) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-request' }) },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustmentRequest('maker-admin', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        reason: 'Partner recovery bonus',
      }),
    ).resolves.toBe(request);

    expect(tx.manualWalletAdjustmentRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestedByAdminId: 'maker-admin',
        requestedBeforeBalance: 0,
        requestedAfterBalance: 200000,
        requestedWalletDelta: 200000,
      }),
    });
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'maker-admin',
        action: 'wallet_adjustment_request.create',
        target: 'manual_wallet_adjustment_request:wallet-request-1',
      }),
    });
  });

  it('hydrates wallet adjustment request operator identities with one bounded user lookup', async () => {
    const requests = [
      {
        id: 'wallet-request-executed',
        requestedByAdminId: 'maker-admin',
        approvedByAdminId: 'approver-admin',
        rejectedByAdminId: null,
        status: ManualWalletAdjustmentRequestStatus.EXECUTED,
      },
      {
        id: 'wallet-request-rejected',
        requestedByAdminId: 'maker-admin',
        approvedByAdminId: null,
        rejectedByAdminId: 'rejecter-admin',
        status: ManualWalletAdjustmentRequestStatus.REJECTED,
      },
    ];
    const prisma = {
      manualWalletAdjustmentRequest: { findMany: vi.fn().mockResolvedValue(requests) },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'maker-admin', email: 'maker@hands.test', fullName: 'Wallet Maker' },
          { id: 'approver-admin', email: 'approver@hands.test', fullName: 'Finance Approver' },
          { id: 'rejecter-admin', email: 'rejecter@hands.test', fullName: 'Finance Reviewer' },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listManualWalletAdjustmentRequests({ status: 'EXECUTED', take: '25', skip: '0' }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'wallet-request-executed',
        requestedBy: expect.objectContaining({ fullName: 'Wallet Maker' }),
        approvedBy: expect.objectContaining({ fullName: 'Finance Approver' }),
        rejectedBy: null,
      }),
      expect.objectContaining({
        id: 'wallet-request-rejected',
        requestedBy: expect.objectContaining({ fullName: 'Wallet Maker' }),
        approvedBy: null,
        rejectedBy: expect.objectContaining({ fullName: 'Finance Reviewer' }),
      }),
    ]);
    expect(prisma.manualWalletAdjustmentRequest.findMany).toHaveBeenCalledWith({
      where: { status: ManualWalletAdjustmentRequestStatus.EXECUTED },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 25,
    });
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['maker-admin', 'approver-admin', 'rejecter-admin'] },
      },
      select: { id: true, email: true, fullName: true },
    });
  });

  it('allows the legacy POST compatibility path to approve only as the signed-in approver', async () => {
    const service = createAdminService({});
    const approve = vi
      .spyOn(service, 'approveManualWalletAdjustmentRequest')
      .mockResolvedValue({ request: { id: 'wallet-request-legacy' } } as never);
    const input = {
      ownerType: 'PARTNER' as const,
      ownerId: 'provider-1',
      direction: 'CREDIT' as const,
      adjustmentType: 'PARTNER_BONUS' as const,
      amount: 200000,
      reason: 'Partner recovery bonus',
      approvalId: 'wallet-request-legacy',
      approvalAdminId: 'finance-admin',
    };

    await expect(
      service.approveManualWalletAdjustmentFromLegacyRoute('finance-admin', input),
    ).resolves.toEqual({ request: { id: 'wallet-request-legacy' } });
    expect(approve).toHaveBeenCalledWith('finance-admin', 'wallet-request-legacy', input);

    await expect(
      service.approveManualWalletAdjustmentFromLegacyRoute('maker-admin', input),
    ).rejects.toThrow('requires the signed-in finance approver');
  });

  it('blocks a legacy POST payload that does not match its persisted approval request', async () => {
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin' }) },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-request-legacy-mismatch',
          ownerType: 'PARTNER',
          ownerId: 'provider-1',
          direction: 'CREDIT',
          adjustmentType: 'PARTNER_BONUS',
          amount: 200000,
          currency: 'VND',
          reason: 'Original approved request',
          monthlyPeriod: null,
          attachmentUrl: null,
          requestedBeforeBalance: 0,
          requestedByAdminId: 'maker-admin',
          status: ManualWalletAdjustmentRequestStatus.REQUESTED,
        }),
        updateMany: vi.fn(),
      },
      providerWalletLedgerEntry: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.approveManualWalletAdjustmentFromLegacyRoute('finance-admin', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 900000,
        reason: 'Tampered request amount',
        approvalId: 'wallet-request-legacy-mismatch',
        approvalAdminId: 'finance-admin',
      }),
    ).rejects.toThrow('does not match the persisted approval request');

    expect(tx.manualWalletAdjustmentRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('executes an approved wallet request atomically with wallet ledger and GL evidence', async () => {
    const storedRequest = {
      id: 'wallet-request-1',
      ownerType: 'PARTNER',
      ownerId: 'provider-1',
      direction: 'CREDIT',
      adjustmentType: 'PARTNER_BONUS',
      amount: 200000,
      currency: 'VND',
      reason: 'Partner recovery bonus',
      monthlyPeriod: null,
      attachmentUrl: null,
      requestedBeforeBalance: 0,
      requestedByAdminId: 'maker-admin',
      status: ManualWalletAdjustmentRequestStatus.REQUESTED,
    };
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin' }) },
      providerProfile: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'provider-1' }) },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn().mockResolvedValue({ id: 'provider-ledger-1', amount: 200000, currency: 'VND' }),
      },
      accountingJournalBatch: { upsert: vi.fn().mockResolvedValue({ id: 'journal-1' }) },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue(storedRequest),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...storedRequest,
          status: ManualWalletAdjustmentRequestStatus.EXECUTED,
          ledgerEntryId: 'provider-ledger-1',
        }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.approveManualWalletAdjustmentRequest('finance-admin', 'wallet-request-1'),
    ).resolves.toMatchObject({
      request: { status: ManualWalletAdjustmentRequestStatus.EXECUTED, ledgerEntryId: 'provider-ledger-1' },
      ledger: { id: 'provider-ledger-1' },
    });

    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'finance-admin', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(tx.manualWalletAdjustmentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-request-1', status: ManualWalletAdjustmentRequestStatus.REQUESTED },
      data: expect.objectContaining({
        approvedByAdminId: 'finance-admin',
        status: ManualWalletAdjustmentRequestStatus.EXECUTED,
      }),
    });
    expect(tx.providerWalletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceKey: 'manual-wallet-adjustment:PARTNER:provider-1:wallet-request-1',
        reference: 'wallet-request-1',
      }),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledTimes(1);
  });

  it('blocks approval when the wallet balance changed after the request was submitted', async () => {
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin' }) },
      providerProfile: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'provider-1' }) },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 50000 } }),
        create: vi.fn(),
      },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-request-stale',
          ownerType: 'PARTNER',
          ownerId: 'provider-1',
          direction: 'CREDIT',
          adjustmentType: 'PARTNER_BONUS',
          amount: 200000,
          currency: 'VND',
          reason: 'Partner recovery bonus',
          monthlyPeriod: null,
          attachmentUrl: null,
          requestedBeforeBalance: 0,
          requestedByAdminId: 'maker-admin',
          status: ManualWalletAdjustmentRequestStatus.REQUESTED,
        }),
        updateMany: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.approveManualWalletAdjustmentRequest('finance-admin', 'wallet-request-stale'),
    ).rejects.toThrow('Wallet balance changed after this request');

    expect(tx.manualWalletAdjustmentRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('blocks a manual wallet adjustment maker from approving their own request', async () => {
    const tx = {
      user: { findFirst: vi.fn() },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-request-self-approval',
          requestedByAdminId: 'maker-admin',
          status: ManualWalletAdjustmentRequestStatus.REQUESTED,
        }),
        updateMany: vi.fn(),
      },
      providerWalletLedgerEntry: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.approveManualWalletAdjustmentRequest('maker-admin', 'wallet-request-self-approval'),
    ).rejects.toThrow('requires approval from a different admin');

    expect(tx.user.findFirst).not.toHaveBeenCalled();
    expect(tx.manualWalletAdjustmentRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a pending manual wallet adjustment without writing wallet or accounting ledgers', async () => {
    const storedRequest = {
      id: 'wallet-request-reject',
      requestedByAdminId: 'maker-admin',
      status: ManualWalletAdjustmentRequestStatus.REQUESTED,
    };
    const rejectedRequest = {
      ...storedRequest,
      status: ManualWalletAdjustmentRequestStatus.REJECTED,
      rejectedByAdminId: 'finance-admin',
      decisionReason: 'Evidence does not support the adjustment',
    };
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin' }) },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue(storedRequest),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(rejectedRequest),
      },
      providerWalletLedgerEntry: { create: vi.fn() },
      customerWalletLedgerEntry: { create: vi.fn() },
      accountingJournalBatch: { upsert: vi.fn() },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-reject' }) },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.rejectManualWalletAdjustmentRequest(
        'finance-admin',
        'wallet-request-reject',
        'Evidence does not support the adjustment',
      ),
    ).resolves.toBe(rejectedRequest);

    expect(tx.manualWalletAdjustmentRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'wallet-request-reject',
        status: ManualWalletAdjustmentRequestStatus.REQUESTED,
      },
      data: expect.objectContaining({
        decisionReason: 'Evidence does not support the adjustment',
        rejectedByAdminId: 'finance-admin',
        status: ManualWalletAdjustmentRequestStatus.REJECTED,
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'wallet_adjustment_request.reject',
        actorId: 'finance-admin',
        target: 'manual_wallet_adjustment_request:wallet-request-reject',
      }),
    });
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.customerWalletLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).not.toHaveBeenCalled();
  });

  it('creates partner manual bonus credits as wallet ledger plus admin audit without touching bank cash', async () => {
    const storedRequest = {
      id: 'approval-1',
      ownerType: 'PARTNER',
      ownerId: 'provider-1',
      direction: 'CREDIT',
      adjustmentType: 'PARTNER_BONUS',
      amount: 200000,
      currency: 'VND',
      reason: 'Excellent customer recovery',
      monthlyPeriod: null,
      attachmentUrl: null,
      requestedBeforeBalance: 0,
      requestedByAdminId: 'admin-user-1',
      status: ManualWalletAdjustmentRequestStatus.REQUESTED,
    };
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
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
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'journal-batch-1' }),
      },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue(storedRequest),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...storedRequest,
          status: ManualWalletAdjustmentRequestStatus.EXECUTED,
          ledgerEntryId: 'ledger-1',
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
      service.approveManualWalletAdjustmentFromLegacyRoute('finance-admin-2', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        reason: 'Excellent customer recovery',
        approvalId: 'approval-1',
        approvalAdminId: 'finance-admin-2',
      }),
    ).resolves.toMatchObject({
      request: { status: ManualWalletAdjustmentRequestStatus.EXECUTED },
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
          approvalAdminId: 'finance-admin-2',
          bankCashAmount: 0,
          companyOutputVat: 0,
          platformRevenueAmount: 0,
        }),
      }),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:manual-wallet-adjustment:PARTNER:provider-1:approval-1' },
      update: expect.objectContaining({
        providerProfileId: 'provider-1',
        sourceId: 'ledger-1',
        sourceType: 'MANUAL_WALLET_ADJUSTMENT',
        totalCredit: 200000,
        totalDebit: 200000,
      }),
      create: expect.objectContaining({
        currency: 'VND',
        entries: {
          create: expect.arrayContaining([
            expect.objectContaining({
              accountCode: 'partner_bonus_expense',
              amount: 200000,
              side: 'DEBIT',
            }),
            expect.objectContaining({
              accountCode: 'partner_wallet_liability',
              amount: 200000,
              side: 'CREDIT',
            }),
          ]),
        },
        providerProfileId: 'provider-1',
        sourceId: 'ledger-1',
        sourceKey: 'accounting-journal:manual-wallet-adjustment:PARTNER:provider-1:approval-1',
        sourceType: 'MANUAL_WALLET_ADJUSTMENT',
        totalCredit: 200000,
        totalDebit: 200000,
      }),
    });
    const journalUpdateEntries = vi.mocked(tx.accountingJournalBatch.upsert).mock.calls[0]?.[0].update
      .entries;
    expect(Object.keys(journalUpdateEntries)).toEqual(['deleteMany', 'create']);
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'finance-admin-2',
        action: 'wallet_ledger.manual_adjustment.create',
        target: 'provider_wallet_ledger:ledger-1',
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'wallet_adjustment_request.execute',
        metadata: expect.objectContaining({ approvalChannel: 'LEGACY_COMPAT' }),
        target: 'manual_wallet_adjustment_request:approval-1',
      }),
    });
  });

  it('creates customer manual promotion credits as wallet ledger plus journal without creating revenue', async () => {
    const storedRequest = {
      id: 'approval-customer-1',
      ownerType: 'CUSTOMER',
      ownerId: 'customer-1',
      direction: 'CREDIT',
      adjustmentType: 'PROMOTION_CREDIT',
      amount: 100000,
      currency: 'VND',
      reason: 'Launch coupon correction',
      monthlyPeriod: null,
      attachmentUrl: null,
      requestedBeforeBalance: 0,
      requestedByAdminId: 'admin-user-1',
      status: ManualWalletAdjustmentRequestStatus.REQUESTED,
    };
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn().mockResolvedValue({
          id: 'customer-ledger-1',
          customerProfileId: 'customer-1',
          amount: 100000,
          currency: 'VND',
        }),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'journal-batch-1' }),
      },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue(storedRequest),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...storedRequest,
          status: ManualWalletAdjustmentRequestStatus.EXECUTED,
          ledgerEntryId: 'customer-ledger-1',
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
      service.approveManualWalletAdjustmentRequest('finance-admin-2', 'approval-customer-1'),
    ).resolves.toMatchObject({
      request: { status: ManualWalletAdjustmentRequestStatus.EXECUTED },
      ledger: { id: 'customer-ledger-1', amount: 100000 },
      preview: {
        walletDelta: 100000,
        bankCashAmount: 0,
        companyOutputVat: 0,
        platformRevenueAmount: 0,
        walletLiabilityIncrease: 100000,
      },
      auditLog: { id: 'audit-1' },
    });

    expect(tx.customerWalletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerProfileId: 'customer-1',
        type: 'ADMIN_ADJUSTMENT',
        sourceKey: 'manual-wallet-adjustment:CUSTOMER:customer-1:approval-customer-1',
        amount: 100000,
        currency: 'VND',
        reference: 'approval-customer-1',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          bankCashAmount: 0,
          companyOutputVat: 0,
          platformRevenueAmount: 0,
          walletLiabilityIncrease: 100000,
        }),
      }),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: {
        sourceKey: 'accounting-journal:manual-wallet-adjustment:CUSTOMER:customer-1:approval-customer-1',
      },
      update: expect.objectContaining({
        customerProfileId: 'customer-1',
        sourceId: 'customer-ledger-1',
        sourceType: 'MANUAL_WALLET_ADJUSTMENT',
        totalCredit: 100000,
        totalDebit: 100000,
      }),
      create: expect.objectContaining({
        currency: 'VND',
        customerProfileId: 'customer-1',
        entries: {
          create: expect.arrayContaining([
            expect.objectContaining({
              accountCode: 'customer_promotion_expense',
              amount: 100000,
              side: 'DEBIT',
            }),
            expect.objectContaining({
              accountCode: 'customer_wallet_liability',
              amount: 100000,
              side: 'CREDIT',
            }),
          ]),
        },
        providerProfileId: null,
        sourceId: 'customer-ledger-1',
        sourceKey: 'accounting-journal:manual-wallet-adjustment:CUSTOMER:customer-1:approval-customer-1',
        sourceType: 'MANUAL_WALLET_ADJUSTMENT',
        totalCredit: 100000,
        totalDebit: 100000,
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'finance-admin-2',
        action: 'wallet_ledger.manual_adjustment.create',
        target: 'customer_wallet_ledger:customer-ledger-1',
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'wallet_adjustment_request.execute',
        metadata: expect.objectContaining({ approvalChannel: 'REQUEST_APPROVAL' }),
        target: 'manual_wallet_adjustment_request:approval-customer-1',
      }),
    });
  });

  it('rejects manual wallet adjustments approved by an admin without finance approver authority before writing a ledger', async () => {
    const tx = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      manualWalletAdjustmentRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'approval-1',
          requestedByAdminId: 'admin-user-1',
          status: ManualWalletAdjustmentRequestStatus.REQUESTED,
        }),
        updateMany: vi.fn(),
      },
      providerProfile: {
        findUniqueOrThrow: vi.fn(),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
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
      service.approveManualWalletAdjustmentRequest('support-user-2', 'approval-1'),
    ).rejects.toThrow('Manual wallet adjustment requires approval from a finance approver');

    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(tx.providerProfile.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.manualWalletAdjustmentRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('lists recent manual wallet adjustments across customer and partner ledgers without loading all rows', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'provider-ledger-1', ownerType: 'PARTNER', createdAt: new Date('2026-06-29T09:00:00.000Z') },
        { id: 'customer-ledger-1', ownerType: 'CUSTOMER', createdAt: new Date('2026-06-28T10:00:00.000Z') },
      ]),
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
              approvalAdminId: 'finance-admin-2',
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
      manualWalletAdjustmentRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            approvedByAdminId: 'finance-admin-2',
            id: 'approval-partner-1',
            requestedByAdminId: 'wallet-maker-1',
          },
          {
            approvedByAdminId: 'finance-admin-3',
            id: 'approval-customer-1',
            requestedByAdminId: 'wallet-maker-2',
          },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'finance-admin-2',
            email: 'approver@example.com',
            fullName: 'Finance Approver',
          },
          {
            id: 'finance-admin-3',
            email: 'approver-3@example.com',
            fullName: 'Finance Approver Three',
          },
          {
            id: 'wallet-maker-1',
            email: 'maker-1@example.com',
            fullName: 'Wallet Maker One',
          },
          {
            id: 'wallet-maker-2',
            email: 'maker-2@example.com',
            fullName: 'Wallet Maker Two',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listManualWalletAdjustments({ skip: '25', take: '25' })).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-ledger-1',
        ownerLabel: 'Smoke Partner',
        ownerType: 'PARTNER',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        approvalAdmin: {
          id: 'finance-admin-2',
          email: 'approver@example.com',
          fullName: 'Finance Approver',
        },
        requestedByAdminId: 'wallet-maker-1',
        requestedBy: {
          id: 'wallet-maker-1',
          email: 'maker-1@example.com',
          fullName: 'Wallet Maker One',
        },
        beforeBalance: 0,
        afterBalance: 200000,
      }),
      expect.objectContaining({
        id: 'customer-ledger-1',
        ownerLabel: 'Demo Customer',
        ownerType: 'CUSTOMER',
        direction: 'CREDIT',
        adjustmentType: 'PROMOTION_CREDIT',
        amount: 100000,
        approvalAdminId: 'finance-admin-3',
        approvalAdmin: {
          id: 'finance-admin-3',
          email: 'approver-3@example.com',
          fullName: 'Finance Approver Three',
        },
        requestedByAdminId: 'wallet-maker-2',
        requestedBy: {
          id: 'wallet-maker-2',
          email: 'maker-2@example.com',
          fullName: 'Wallet Maker Two',
        },
        beforeBalance: 0,
        afterBalance: 100000,
      }),
    ]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.customerWalletLedgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['customer-ledger-1'] },
          type: CustomerWalletLedgerType.ADMIN_ADJUSTMENT,
        }),
      }),
    );
    expect(prisma.customerWalletLedgerEntry.findMany.mock.calls[0][0]).not.toHaveProperty('take');
    expect(prisma.customerWalletLedgerEntry.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
    expect(prisma.providerWalletLedgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['provider-ledger-1'] },
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
    expect(prisma.providerWalletLedgerEntry.findMany.mock.calls[0][0]).not.toHaveProperty('take');
    expect(prisma.providerWalletLedgerEntry.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
    expect(prisma.manualWalletAdjustmentRequest.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['approval-partner-1', 'approval-customer-1'] } },
      select: { id: true, approvedByAdminId: true, requestedByAdminId: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['finance-admin-2', 'wallet-maker-1', 'finance-admin-3', 'wallet-maker-2'],
        },
      },
      select: { id: true, email: true, fullName: true },
    });
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

    await expect(
      service.manualWalletAdjustmentSummary({ ownerType: 'PARTNER', ownerId: 'provider-1' }),
    ).resolves.toEqual({
      total: 8,
    });
    await expect(
      service.manualWalletAdjustmentSummary({ ownerType: 'CUSTOMER', ownerId: 'customer-1' }),
    ).resolves.toEqual({
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
      manualWalletAdjustmentRequest: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustmentRequest('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 10000000,
        reason: 'High-value correction',
      }),
    ).rejects.toThrow('Attachment is required for this manual wallet adjustment');

    expect(tx.manualWalletAdjustmentRequest.create).not.toHaveBeenCalled();
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
      manualWalletAdjustmentRequest: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustmentRequest('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 10000000,
        reason: 'High-value correction with invalid evidence URL',
        attachmentUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('Attachment URL must use http or https');

    expect(tx.manualWalletAdjustmentRequest.create).not.toHaveBeenCalled();
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
      manualWalletAdjustmentRequest: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createManualWalletAdjustmentRequest('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'missing-provider',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 100000,
        reason: 'Missing owner should not write ledger',
      }),
    ).rejects.toThrow('Manual wallet adjustment owner was not found');

    expect(tx.manualWalletAdjustmentRequest.create).not.toHaveBeenCalled();
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
        approvalAdminId: 'finance-admin-2',
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
          approvalAdminId: 'finance-admin-2',
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

  it('hydrates withdrawal reviewer, payout executor, and separate approver identities for admin lists', async () => {
    const earnings = {
      listProviderWalletWithdrawalRequestsForAdmin: vi.fn().mockResolvedValue([
        {
          id: 'withdrawal-request-1',
          status: ProviderWalletWithdrawalRequestStatus.PAID,
          reviewedByAdminId: 'finance-maker-1',
          metadata: { bankPayout: { completedByAdminId: 'finance-maker-1' } },
        },
      ]),
    };
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            target: 'provider_wallet_withdrawal_request:withdrawal-request-1',
            metadata: { approvalAdminId: 'finance-approver-2' },
          },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'finance-maker-1', email: 'maker@hands.test', fullName: 'Finance Maker' },
          { id: 'finance-approver-2', email: 'approver@hands.test', fullName: 'Finance Approver' },
        ]),
      },
    };
    const service = createAdminService(prisma, { earnings });

    await expect(service.listProviderWalletWithdrawalRequests({ take: 10 })).resolves.toEqual([
      expect.objectContaining({
        id: 'withdrawal-request-1',
        reviewedBy: expect.objectContaining({ fullName: 'Finance Maker' }),
        paidBy: expect.objectContaining({ fullName: 'Finance Maker' }),
        approvalAdminId: 'finance-approver-2',
        approvalAdmin: expect.objectContaining({ fullName: 'Finance Approver' }),
      }),
    ]);

    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: 'provider_wallet.withdrawal_request.update',
        target: { in: ['provider_wallet_withdrawal_request:withdrawal-request-1'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, target: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['finance-maker-1', 'finance-approver-2'] } },
      select: { id: true, email: true, fullName: true },
    });
  });

  it('rejects paid provider wallet withdrawal request closeout without separate approval', async () => {
    const earnings = {
      updateProviderWalletWithdrawalRequestForAdmin: vi.fn(),
    };
    const service = createAdminService({}, { earnings });

    await expect(
      service.updateProviderWalletWithdrawalRequest('admin-user-1', 'withdrawal-request-1', {
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
      }),
    ).rejects.toThrow('Provider wallet withdrawal paid closeout requires approval from a different admin');

    await expect(
      service.updateProviderWalletWithdrawalRequest('admin-user-1', 'withdrawal-request-1', {
        approvalAdminId: 'admin-user-1',
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
      } as never),
    ).rejects.toThrow('Provider wallet withdrawal paid closeout requires approval from a different admin');

    expect(earnings.updateProviderWalletWithdrawalRequestForAdmin).not.toHaveBeenCalled();
  });

  it('rejects paid provider wallet withdrawal request closeout approved by an admin without finance approver authority', async () => {
    const earnings = {
      updateProviderWalletWithdrawalRequestForAdmin: vi.fn(),
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.updateProviderWalletWithdrawalRequest('admin-user-1', 'withdrawal-request-1', {
        approvalAdminId: 'support-user-2',
        status: 'PAID',
        transferRef: 'BANK-OUT-001',
      }),
    ).rejects.toThrow('Provider wallet withdrawal paid closeout requires approval from a finance approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(earnings.updateProviderWalletWithdrawalRequestForAdmin).not.toHaveBeenCalled();
  });

  it('requires separate approval before marking payout batches as paid', async () => {
    const earnings = {
      updatePayoutBatch: vi.fn(),
    };
    const service = createAdminService({}, { earnings });

    await expect(
      service.updatePayoutBatch('admin-user-1', 'payout-batch-1', {
        status: PayoutBatchStatus.PAID,
        transferRef: 'BANK-PAYOUT-001',
      }),
    ).rejects.toThrow('Payout batch paid closeout requires approval from a different admin');

    await expect(
      service.updatePayoutBatch('admin-user-1', 'payout-batch-1', {
        approvalAdminId: 'admin-user-1',
        status: PayoutBatchStatus.PAID,
        transferRef: 'BANK-PAYOUT-001',
      } as never),
    ).rejects.toThrow('Payout batch paid closeout requires approval from a different admin');

    expect(earnings.updatePayoutBatch).not.toHaveBeenCalled();
  });

  it('rejects payout batch paid closeout approved by an admin without finance approver authority', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const earnings = {
      updatePayoutBatch: vi.fn(),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.updatePayoutBatch('admin-user-1', 'payout-batch-1', {
        approvalAdminId: 'support-user-2',
        status: PayoutBatchStatus.PAID,
        transferRef: 'BANK-PAYOUT-001',
      } as never),
    ).rejects.toThrow('Payout batch paid closeout requires approval from a finance approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(earnings.updatePayoutBatch).not.toHaveBeenCalled();
  });

  it('rejects payout batch paid closeout without a transfer reference at the API boundary', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
    };
    const earnings = {
      updatePayoutBatch: vi.fn(),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.updatePayoutBatch('admin-user-1', 'payout-batch-1', {
        approvalAdminId: 'finance-admin-2',
        status: PayoutBatchStatus.PAID,
        transferRef: '   ',
      } as never),
    ).rejects.toThrow('Payout batch paid closeout requires a transfer reference');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'finance-admin-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(earnings.updatePayoutBatch).not.toHaveBeenCalled();
  });

  it('audits the separate approver when marking payout batches as paid', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const earnings = {
      updatePayoutBatch: vi.fn().mockResolvedValue({
        id: 'payout-batch-1',
        status: PayoutBatchStatus.PAID,
        transferRef: 'BANK-PAYOUT-001',
        earnings: [{ id: 'earning-1' }, { id: 'earning-2' }],
      }),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.updatePayoutBatch('admin-user-1', 'payout-batch-1', {
        approvalAdminId: 'finance-admin-2',
        status: PayoutBatchStatus.PAID,
        transferRef: 'BANK-PAYOUT-001',
      } as never),
    ).resolves.toEqual(expect.objectContaining({ id: 'payout-batch-1', status: PayoutBatchStatus.PAID }));

    expect(earnings.updatePayoutBatch).toHaveBeenCalledWith('payout-batch-1', {
      status: PayoutBatchStatus.PAID,
      transferRef: 'BANK-PAYOUT-001',
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'payout_batch.update',
        actorId: 'admin-user-1',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          earningCount: 2,
          status: PayoutBatchStatus.PAID,
        }),
        target: 'payout_batch:payout-batch-1',
      }),
    });
  });

  it('lists missing booking settlements with bounded server pagination and age/search filters', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T00:00:00.000Z'));
    const gapAt = new Date('2026-07-09T00:00:00.000Z');
    const prisma = {
      booking: {
        count: vi.fn().mockResolvedValue(51),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'booking-gap-1',
            status: BookingStatus.COMPLETED,
            createdAt: gapAt,
            updatedAt: gapAt,
            closedAt: null,
            customerProfile: { id: 'customer-1', user: { fullName: 'Customer One', phone: '0901' } },
            selectedProvider: {
              id: 'partner-1',
              displayName: 'Partner One',
              user: { fullName: null, phone: '0902' },
            },
            payment: {
              id: 'payment-1',
              amount: 500000,
              currency: 'VND',
              method: PaymentMethod.CARD,
              status: PaymentStatus.CAPTURED,
            },
            earning: {
              id: 'earning-1',
              paidAt: null,
              payoutBatchId: null,
              status: EarningStatus.AVAILABLE,
            },
            _count: {
              platformFeeLogs: 0,
              services: 1,
              taxLogs: 0,
              walletLedgerEntries: 0,
            },
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    try {
      await expect(
        service.listBookingSettlementGaps({
          age: '3-7d',
          paymentMethod: 'card',
          period: '2026-07',
          q: ' Customer ',
          skip: '20',
          take: '999',
          track: 'canonical',
        }),
      ).resolves.toMatchObject({
        generatedAt: '2026-07-13T00:00:00.000Z',
        hasNext: true,
        items: [
          expect.objectContaining({
            ageBucket: '3_TO_7_DAYS',
            gapAt: '2026-07-09T00:00:00.000Z',
            id: 'booking-gap-1',
            repairTrack: 'canonical',
          }),
        ],
        skip: 20,
        take: 50,
        total: 51,
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          skip: 20,
          take: 50,
          select: expect.objectContaining({
            customerProfile: expect.any(Object),
            payment: expect.any(Object),
            selectedProvider: expect.any(Object),
          }),
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { status: BookingStatus.COMPLETED },
              { settlementSnapshot: { is: null } },
              { payment: { is: { method: PaymentMethod.CARD } } },
              {
                OR: [
                  {
                    closedAt: {
                      gte: new Date('2026-06-30T17:00:00.000Z'),
                      lt: new Date('2026-07-31T17:00:00.000Z'),
                    },
                  },
                  {
                    closedAt: null,
                    updatedAt: {
                      gte: new Date('2026-06-30T17:00:00.000Z'),
                      lt: new Date('2026-07-31T17:00:00.000Z'),
                    },
                  },
                ],
              },
              expect.objectContaining({ OR: expect.any(Array) }),
              expect.objectContaining({
                OR: expect.arrayContaining([
                  {
                    closedAt: expect.objectContaining({
                      gte: new Date('2026-07-06T00:00:00.000Z'),
                      lt: new Date('2026-07-10T00:00:00.000Z'),
                    }),
                  },
                ]),
              }),
              expect.objectContaining({ OR: expect.any(Array) }),
            ]),
          }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('summarizes settlement gaps into recent and backlog age buckets with the oldest timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T00:00:00.000Z'));
    const prisma = {
      booking: {
        count: vi
          .fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(9),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            closedAt: new Date('2026-07-01T00:00:00.000Z'),
            updatedAt: new Date('2026-07-02T00:00:00.000Z'),
          })
          .mockResolvedValueOnce({ closedAt: null, updatedAt: new Date('2026-06-30T00:00:00.000Z') }),
      },
    };
    const service = createAdminService(prisma);

    try {
      await expect(service.bookingSettlementGapSummary()).resolves.toEqual({
        age24To72Hours: 3,
        age3To7Days: 4,
        age7DaysPlus: 5,
        backlog: 12,
        canonical: 6,
        evidenceBlocked: 8,
        generatedAt: '2026-07-13T00:00:00.000Z',
        historicalReady: 7,
        manualReview: 9,
        oldestGapAt: '2026-06-30T00:00:00.000Z',
        recent: 2,
        total: 14,
      });

      expect(prisma.booking.count).toHaveBeenCalledTimes(8);
      expect(prisma.booking.count).toHaveBeenNthCalledWith(
        6,
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                earning: { is: { paidAt: { not: null }, status: EarningStatus.PAID } },
              }),
            ]),
          }),
        }),
      );
      expect(prisma.booking.count).toHaveBeenNthCalledWith(
        7,
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                AND: expect.arrayContaining([{ earning: { is: { status: EarningStatus.PAID } } }]),
              }),
            ]),
          }),
        }),
      );
      expect(prisma.booking.findFirst).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aggregates a bounded read-only dry-run for historical settlement gaps', async () => {
    const prisma = {
      booking: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([{ id: 'historical-gap-1' }, { id: 'historical-gap-2' }]),
      },
    };
    const service = createAdminService(prisma);
    vi.spyOn(service, 'previewBookingSettlementGapRepair').mockImplementation(async (bookingId) => {
      const isFirst = bookingId === 'historical-gap-1';
      const amount = isFirst ? 400_000 : 500_000;
      return {
        blockers: isFirst ? [] : [{ code: 'MONTHLY_PERIOD_FINALIZED', message: 'Period is closed.' }],
        bookingId,
        bookingStatus: BookingStatus.COMPLETED,
        canRepair: isFirst,
        completedAt: '2026-06-10T03:00:00.000Z',
        currency: 'VND',
        customer: null,
        earning: null,
        historicalEvidenceSummary: null,
        historicalSettlementDryRun: {
          amounts: {
            companyOutputVat: isFirst ? 0 : 8_000,
            customerWalletCreditAmount: 0,
            customerWalletDebitAmount: 0,
            partnerPitAmount: 20_000,
            partnerTaxableRevenue: amount,
            partnerVatAmount: 0,
            partnerWalletDelta: 300_000,
            partnerWithholdingTotal: 20_000,
            paymentProcessingFee: 0,
            platformFeeNetRevenue: 80_000,
          },
          currency: 'VND',
          customerPaymentAmount: amount,
          journal: {
            entries: [],
            reconciliationDelta: isFirst ? 0 : 100,
            totalCredit: amount,
            totalDebit: amount,
          },
          metadata: {},
          monthlyPeriod: '2026-06',
          partnerPayoutAmount: amount - 100_000,
          paymentFeeFixedAmount: 0,
          paymentFeePayer: PaymentFeePayer.HANDS,
          paymentFeePolicyVersionId: isFirst ? null : 'payment-fee-policy-1',
          paymentFeeRateBps: 0,
          paymentFeeRuleSnapshot: isFirst
            ? { method: PaymentMethod.MOMO, reason: 'NO_ACTIVE_PAYMENT_FEE_POLICY' }
            : { ruleId: 'payment-fee-rule-1' },
          paymentFeeTreatment: PaymentFeeTreatment.OPERATING_EXPENSE,
          platformFeeGross: isFirst ? 80_000 : 88_000,
          platformFeePolicyVersionId: isFirst ? null : 'platform-fee-policy-1',
          platformFeeRuleSnapshot: isFirst
            ? { source: 'SERVICE_PAYOUT_RULE', lines: [{ ruleId: 'payout-rule-1', vatBps: 0 }] }
            : { ruleId: 'platform-fee-rule-1' },
          platformVatRateBps: isFirst ? 0 : 800,
        },
        monthlyClosingStatus: isFirst ? null : MonthlyTaxClosingStatus.CLOSED,
        monthlyPeriod: '2026-06',
        partner: null,
        payment: {
          amount,
          currency: 'VND',
          id: `payment-${bookingId}`,
          method: isFirst ? PaymentMethod.MOMO : PaymentMethod.CASH,
          status: PaymentStatus.CAPTURED,
        },
        preservesExistingEarningLifecycle: true,
        repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION',
        serviceCount: 1,
        settlementSnapshotId: null,
      } as never;
    });

    await expect(
      service.bookingSettlementGapDryRun({ period: '2026-06', take: '500' }),
    ).resolves.toMatchObject({
      blockerCodes: { MONTHLY_PERIOD_FINALIZED: 1 },
      counts: {
        blocked: 1,
        companyOutputVatPositive: 1,
        companyOutputVatZero: 1,
        eligible: 1,
        journalBalanced: 2,
        paymentFeeDefaulted: 1,
        paymentFeePolicyMatched: 1,
        platformVatEvidenceReady: 2,
        platformVatExplicitZeroServiceRule: 1,
        platformVatUnexplainedZero: 0,
        platformVatZeroFromPolicy: 0,
        reconciliationReview: 1,
      },
      evaluated: 2,
      paymentMethods: { CASH: 1, MOMO: 1 },
      policyGate: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'PAYMENT_FEE_POLICY_DEFAULTED', count: 1 }),
          expect.objectContaining({ code: 'PREVIEW_BLOCKED', count: 1 }),
          expect.objectContaining({ code: 'JOURNAL_RECONCILIATION_REVIEW', count: 1 }),
        ]),
        status: 'REVIEW_REQUIRED',
      },
      periodStatuses: { CLOSED: 1, OPEN_OR_UNLINKED: 1 },
      recoveryBatches: [
        expect.objectContaining({
          batchKey: 'cash-1',
          bookingIds: ['historical-gap-2'],
          executionStatus: 'REVIEW_REQUIRED',
          paymentMethod: PaymentMethod.CASH,
          recordCount: 1,
        }),
        expect.objectContaining({
          batchKey: 'momo-1',
          bookingIds: ['historical-gap-1'],
          executionStatus: 'REVIEW_REQUIRED',
          paymentMethod: PaymentMethod.MOMO,
          recordCount: 1,
        }),
      ],
      totalMatched: 2,
      truncated: false,
    });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true }, take: 100 }),
    );
  });

  it('blocks dry-run approval only when zero platform VAT lacks retained rule or policy evidence', async () => {
    const prisma = {
      booking: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([{ id: 'historical-gap-unexplained-vat' }]),
      },
    };
    const service = createAdminService(prisma);
    vi.spyOn(service, 'previewBookingSettlementGapRepair').mockResolvedValue({
      blockers: [],
      bookingId: 'historical-gap-unexplained-vat',
      canRepair: true,
      completedAt: '2026-06-10T03:00:00.000Z',
      historicalSettlementDryRun: {
        amounts: {
          companyOutputVat: 0,
          partnerWithholdingTotal: 20_000,
          paymentProcessingFee: 0,
          platformFeeNetRevenue: 80_000,
        },
        customerPaymentAmount: 400_000,
        journal: { reconciliationDelta: 0, totalCredit: 400_000, totalDebit: 400_000 },
        partnerPayoutAmount: 300_000,
        paymentFeePolicyVersionId: 'payment-fee-policy-1',
        paymentFeeRuleSnapshot: { ruleId: 'payment-fee-rule-1' },
        platformFeeGross: 80_000,
        platformFeePolicyVersionId: null,
        platformFeeRuleSnapshot: null,
        platformVatRateBps: 0,
      },
      monthlyClosingStatus: null,
      monthlyPeriod: '2026-06',
      payment: { method: PaymentMethod.MOMO },
    } as never);

    await expect(service.bookingSettlementGapDryRun({ take: 1 })).resolves.toMatchObject({
      counts: {
        platformVatEvidenceReady: 0,
        platformVatExplicitZeroServiceRule: 0,
        platformVatUnexplainedZero: 1,
        platformVatZeroFromPolicy: 0,
      },
      policyGate: {
        issues: [
          expect.objectContaining({ code: 'PLATFORM_VAT_EVIDENCE_UNEXPLAINED', count: 1 }),
        ],
        status: 'REVIEW_REQUIRED',
      },
      recoveryBatches: [expect.objectContaining({ executionStatus: 'REVIEW_REQUIRED' })],
    });
  });

  it('previews settlement repair eligibility without writing finance records', async () => {
    const occurredAt = new Date('2026-07-10T03:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-gap-1',
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.COMPLETED,
          createdAt: occurredAt,
          updatedAt: occurredAt,
          closedAt: occurredAt,
          customerProfile: { id: 'customer-1', user: { fullName: 'Customer One', phone: '0901' } },
          selectedProvider: {
            id: 'partner-1',
            displayName: 'Partner One',
            user: { fullName: null, phone: '0902' },
          },
          payment: {
            id: 'payment-1',
            amount: 500_000,
            currency: 'VND',
            method: PaymentMethod.CARD,
            status: PaymentStatus.CAPTURED,
          },
          earning: {
            id: 'earning-1',
            status: EarningStatus.AVAILABLE,
            grossAmount: 500_000,
            platformFee: 100_000,
            withholdingAmount: 35_000,
            netAmount: 365_000,
            currency: 'VND',
            paidAt: null,
            payoutBatchId: null,
          },
          settlementSnapshot: null,
          _count: { services: 1 },
        }),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({ status: MonthlyTaxClosingStatus.REVIEWED }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.previewBookingSettlementGapRepair('booking-gap-1')).resolves.toMatchObject({
      bookingId: 'booking-gap-1',
      blockers: [],
      canRepair: true,
      completedAt: occurredAt.toISOString(),
      currency: 'VND',
      monthlyClosingStatus: MonthlyTaxClosingStatus.REVIEWED,
      monthlyPeriod: '2026-07',
      preservesExistingEarningLifecycle: true,
      repairMode: 'CANONICAL_COMPLETION_SETTLEMENT',
      serviceCount: 1,
    });
    expect(prisma.monthlyTaxClosing.findUnique).toHaveBeenCalledWith({
      where: { period_currency: { period: '2026-07', currency: 'VND' } },
      select: { status: true },
    });
  });

  it('blocks direct repair for finalized periods and payout-locked earnings', async () => {
    const occurredAt = new Date('2026-06-10T03:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-gap-locked',
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.COMPLETED,
          createdAt: occurredAt,
          updatedAt: occurredAt,
          closedAt: occurredAt,
          customerProfile: { id: 'customer-1', user: { fullName: null, phone: '0901' } },
          selectedProvider: {
            id: 'partner-1',
            displayName: 'Partner One',
            user: { fullName: null, phone: '0902' },
          },
          payment: {
            id: 'payment-1',
            amount: 500_000,
            currency: 'VND',
            method: PaymentMethod.CARD,
            status: PaymentStatus.CAPTURED,
          },
          earning: {
            id: 'earning-1',
            status: EarningStatus.PAID,
            grossAmount: 500_000,
            platformFee: 100_000,
            withholdingAmount: 35_000,
            netAmount: 365_000,
            currency: 'VND',
            paidAt: occurredAt,
            payoutBatchId: 'payout-1',
          },
          settlementSnapshot: null,
          _count: { services: 1 },
        }),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({ status: MonthlyTaxClosingStatus.CLOSED }),
      },
    };
    const earnings = {
      previewPaidBookingSettlementReconstruction: vi.fn().mockResolvedValue({
        canReconstruct: false,
        blockers: [
          {
            code: 'PLATFORM_FEE_LOG_AMBIGUOUS',
            message: 'Exactly one retained platform fee log is required.',
          },
        ],
        evidence: null,
        evidenceSummary: { platformFeeLogCount: 0, taxLogCount: 1, walletLedgerEntryCount: 2 },
      }),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(service.previewBookingSettlementGapRepair('booking-gap-locked')).resolves.toMatchObject({
      canRepair: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'PLATFORM_FEE_LOG_AMBIGUOUS' }),
        expect.objectContaining({ code: 'MONTHLY_PERIOD_FINALIZED' }),
      ]),
      repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION',
    });
  });

  it('repairs an eligible settlement through the canonical completion path with dual approval and audit', async () => {
    const occurredAt = new Date('2026-07-10T03:00:00.000Z');
    const booking = {
      id: 'booking-gap-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'partner-1',
      status: BookingStatus.COMPLETED,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      closedAt: occurredAt,
      customerProfile: { id: 'customer-1', user: { fullName: 'Customer One', phone: '0901' } },
      selectedProvider: {
        id: 'partner-1',
        displayName: 'Partner One',
        user: { fullName: null, phone: '0902' },
      },
      payment: {
        id: 'payment-1',
        amount: 500_000,
        currency: 'VND',
        method: PaymentMethod.CARD,
        status: PaymentStatus.CAPTURED,
      },
      earning: {
        id: 'earning-1',
        status: EarningStatus.AVAILABLE,
        grossAmount: 500_000,
        platformFee: 100_000,
        withholdingAmount: 35_000,
        netAmount: 365_000,
        currency: 'VND',
        paidAt: null,
        payoutBatchId: null,
      },
      settlementSnapshot: null,
      _count: { services: 1 },
    };
    const prisma = {
      adminAuditLog: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'audit-requested-1' })
          .mockResolvedValueOnce({ id: 'audit-completed-1' }),
      },
      booking: { findUnique: vi.fn().mockResolvedValue(booking) },
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'settlement-1',
          sourceKey: 'booking-settlement:booking-gap-1',
          monthlyPeriod: '2026-07',
        }),
      },
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
    };
    const earnings = {
      createForCompletedBooking: vi.fn().mockResolvedValue({ id: 'earning-1' }),
    };
    const service = createAdminService(prisma, { earnings });
    vi.spyOn(service, 'verifyBookingSettlementRepair').mockResolvedValue({
      blockingFailures: [],
      bookingId: 'booking-gap-1',
      checkedAt: occurredAt,
      checks: [],
      passed: true,
      repairMode: 'CANONICAL_COMPLETION_SETTLEMENT',
      snapshotId: 'settlement-1',
      status: 'PASSED',
    });

    await expect(
      service.repairBookingSettlementGap('admin-1', 'booking-gap-1', {
        approvalAdminId: 'finance-admin-2',
        reason: 'Restore missing completion settlement',
      }),
    ).resolves.toEqual({
      approvalAdminId: 'finance-admin-2',
      auditLogId: 'audit-completed-1',
      bookingId: 'booking-gap-1',
      checkpoint: expect.objectContaining({ passed: true, status: 'PASSED' }),
      earningId: 'earning-1',
      repairMode: 'CANONICAL_COMPLETION_SETTLEMENT',
      repaired: true,
      settlementSnapshotId: 'settlement-1',
    });

    expect(earnings.createForCompletedBooking).toHaveBeenCalledWith('booking-gap-1', 'partner-1', {
      preserveExistingLifecycle: true,
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.adminAuditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        action: 'booking_settlement_gap.repaired',
        actorId: 'admin-1',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          settlementSnapshotId: 'settlement-1',
        }),
        target: 'booking:booking-gap-1',
      }),
    });
  });

  it('reconstructs a paid settlement from retained evidence without invoking canonical earning mutation', async () => {
    const occurredAt = new Date('2026-06-10T03:00:00.000Z');
    const booking = {
      id: 'booking-gap-paid',
      customerProfileId: 'customer-1',
      selectedProviderId: 'partner-1',
      status: BookingStatus.COMPLETED,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      closedAt: occurredAt,
      customerProfile: { id: 'customer-1', user: { fullName: 'Customer One', phone: '0901' } },
      selectedProvider: {
        id: 'partner-1',
        displayName: 'Partner One',
        user: { fullName: null, phone: '0902' },
      },
      payment: {
        id: 'payment-1',
        amount: 400_000,
        currency: 'VND',
        method: PaymentMethod.MOMO,
        status: PaymentStatus.CAPTURED,
      },
      earning: {
        id: 'earning-paid-1',
        status: EarningStatus.PAID,
        grossAmount: 400_000,
        platformFee: 80_000,
        withholdingAmount: 20_000,
        netAmount: 300_000,
        currency: 'VND',
        paidAt: occurredAt,
        payoutBatchId: 'payout-1',
      },
      settlementSnapshot: null,
      _count: { services: 1 },
    };
    const prisma = {
      adminAuditLog: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'audit-requested-1' })
          .mockResolvedValueOnce({ id: 'audit-completed-1' }),
      },
      booking: { findUnique: vi.fn().mockResolvedValue(booking) },
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'settlement-paid-1',
          sourceKey: 'booking-settlement:booking-gap-paid',
          monthlyPeriod: '2026-06',
        }),
      },
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
    };
    const earnings = {
      createForCompletedBooking: vi.fn(),
      previewPaidBookingSettlementReconstruction: vi.fn().mockResolvedValue({
        canReconstruct: true,
        blockers: [],
        evidence: { bookingId: 'booking-gap-paid' },
        evidenceSummary: { platformFeeLogCount: 1, taxLogCount: 1, walletLedgerEntryCount: 2 },
      }),
      reconstructPaidBookingSettlement: vi.fn().mockResolvedValue({
        earningId: 'earning-paid-1',
        settlementSnapshot: { id: 'settlement-paid-1' },
      }),
    };
    const service = createAdminService(prisma, { earnings });
    vi.spyOn(service, 'verifyBookingSettlementRepair').mockRejectedValue(
      new Error('checkpoint read failed'),
    );

    await expect(
      service.repairBookingSettlementGap('admin-1', 'booking-gap-paid', {
        approvalAdminId: 'finance-admin-2',
        reason: 'Reconstruct historical paid settlement evidence',
      }),
    ).resolves.toMatchObject({
      bookingId: 'booking-gap-paid',
      checkpoint: expect.objectContaining({
        blockingFailures: ['CHECKPOINT_UNAVAILABLE'],
        passed: false,
        status: 'FAILED',
      }),
      earningId: 'earning-paid-1',
      repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION',
      repaired: true,
      settlementSnapshotId: 'settlement-paid-1',
    });
    expect(earnings.reconstructPaidBookingSettlement).toHaveBeenCalledWith('booking-gap-paid', 'partner-1', {
      actorId: 'admin-1',
      approvalAdminId: 'finance-admin-2',
      reason: 'Reconstruct historical paid settlement evidence',
    });
    expect(earnings.createForCompletedBooking).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        action: 'booking_settlement_gap.historical_reconstructed',
        actorId: 'admin-1',
        metadata: expect.objectContaining({
          checkpointBlockingFailures: ['CHECKPOINT_UNAVAILABLE'],
          checkpointStatus: 'FAILED',
        }),
        target: 'booking:booking-gap-paid',
      }),
    });
  });

  it('passes the post-repair checkpoint when historical journal, clearing, and retained evidence reconcile', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'settlement-paid-1',
          sourceKey: 'booking-settlement:booking-gap-paid',
          bookingId: 'booking-gap-paid',
          paymentId: 'payment-1',
          providerEarningId: 'earning-paid-1',
          paymentMethod: PaymentMethod.MOMO,
          currency: 'VND',
          customerPaymentAmount: 400_000,
          partnerPayoutAmount: 300_000,
          partnerWithholdingTotal: 20_000,
          platformFeeGross: 80_000,
          providerTaxLogIds: ['tax-1'],
          providerPlatformFeeLogId: 'fee-1',
          providerWalletLedgerEntryIds: ['wallet-earning-1', 'wallet-paid-1'],
          metadata: { historicalReconstruction: true },
          accountingJournalBatches: [
            {
              id: 'journal-1',
              sourceKey: 'accounting-journal:booking-settlement:booking-gap-paid',
              sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
              sourceId: 'settlement-paid-1',
              settlementSnapshotId: 'settlement-paid-1',
              status: AccountingJournalBatchStatus.POSTED,
              totalDebit: 400_000,
              totalCredit: 400_000,
              metadata: { reconciliationDelta: 0 },
              entries: [
                { side: AccountingJournalEntrySide.DEBIT, amount: 400_000 },
                { side: AccountingJournalEntrySide.CREDIT, amount: 300_000 },
                { side: AccountingJournalEntrySide.CREDIT, amount: 20_000 },
                { side: AccountingJournalEntrySide.CREDIT, amount: 80_000 },
              ],
            },
          ],
          paymentClearingEntries: [
            {
              id: 'clearing-1',
              sourceKey: 'booking-payment-clearing:booking-gap-paid:settlement',
              type: BookingPaymentClearingEntryType.SETTLEMENT_POSTED,
              status: BookingPaymentClearingStatus.OPEN,
              paymentId: 'payment-1',
              settlementSnapshotId: 'settlement-paid-1',
              amount: 400_000,
              currency: 'VND',
            },
          ],
          providerEarning: {
            id: 'earning-paid-1',
            status: EarningStatus.PAID,
            paidAt: new Date('2026-06-10T03:00:00.000Z'),
            grossAmount: 400_000,
            netAmount: 300_000,
            currency: 'VND',
            platformFeeLogs: [{ id: 'fee-1' }],
            taxLogs: [{ id: 'tax-1' }],
            walletLedgerEntries: [
              {
                id: 'wallet-earning-1',
                type: ProviderWalletLedgerType.BOOKING_EARNING,
                amount: 300_000,
              },
              {
                id: 'wallet-paid-1',
                type: ProviderWalletLedgerType.PAYOUT_PAID,
                amount: -300_000,
              },
            ],
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    const result = await service.verifyBookingSettlementRepair('booking-gap-paid');

    expect(result).toMatchObject({
      blockingFailures: [],
      bookingId: 'booking-gap-paid',
      passed: true,
      repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION',
      snapshotId: 'settlement-paid-1',
      status: 'PASSED',
    });
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it('accepts a cash settlement checkpoint without an external payment clearing entry', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'settlement-cash-1',
          sourceKey: 'booking-settlement:booking-cash-1',
          bookingId: 'booking-cash-1',
          paymentId: 'payment-cash-1',
          providerEarningId: 'earning-cash-1',
          paymentMethod: PaymentMethod.CASH,
          currency: 'VND',
          customerPaymentAmount: 400_000,
          partnerPayoutAmount: 320_000,
          partnerWithholdingTotal: 0,
          platformFeeGross: 80_000,
          providerTaxLogIds: null,
          providerPlatformFeeLogId: null,
          providerWalletLedgerEntryIds: null,
          metadata: null,
          accountingJournalBatches: [
            {
              id: 'journal-cash-1',
              sourceKey: 'accounting-journal:booking-settlement:booking-cash-1',
              sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
              sourceId: 'settlement-cash-1',
              settlementSnapshotId: 'settlement-cash-1',
              status: AccountingJournalBatchStatus.POSTED,
              totalDebit: 80_000,
              totalCredit: 80_000,
              metadata: { reconciliationDelta: 0 },
              entries: [
                { side: AccountingJournalEntrySide.DEBIT, amount: 80_000 },
                { side: AccountingJournalEntrySide.CREDIT, amount: 80_000 },
              ],
            },
          ],
          paymentClearingEntries: [],
          providerEarning: {
            id: 'earning-cash-1',
            status: EarningStatus.AVAILABLE,
            paidAt: null,
            grossAmount: 400_000,
            netAmount: -80_000,
            currency: 'VND',
            platformFeeLogs: [],
            taxLogs: [],
            walletLedgerEntries: [],
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    const result = await service.verifyBookingSettlementRepair('booking-cash-1');

    expect(result.passed).toBe(true);
    expect(result.checks.find((check) => check.code === 'PAYMENT_CLEARING_EXPECTATION')).toMatchObject({
      actual: 0,
      expected: 0,
      passed: true,
    });
  });

  it('fails the post-repair checkpoint when journal or clearing evidence is inconsistent', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'settlement-broken-1',
          sourceKey: 'booking-settlement:booking-broken-1',
          bookingId: 'booking-broken-1',
          paymentId: 'payment-broken-1',
          providerEarningId: 'earning-broken-1',
          paymentMethod: PaymentMethod.CARD,
          currency: 'VND',
          customerPaymentAmount: 400_000,
          partnerPayoutAmount: 300_000,
          partnerWithholdingTotal: 20_000,
          platformFeeGross: 80_000,
          providerTaxLogIds: null,
          providerPlatformFeeLogId: null,
          providerWalletLedgerEntryIds: null,
          metadata: null,
          accountingJournalBatches: [
            {
              id: 'journal-broken-1',
              sourceKey: 'accounting-journal:booking-settlement:booking-broken-1',
              sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
              sourceId: 'settlement-broken-1',
              settlementSnapshotId: 'settlement-broken-1',
              status: AccountingJournalBatchStatus.POSTED,
              totalDebit: 400_000,
              totalCredit: 390_000,
              metadata: { reconciliationDelta: 10_000 },
              entries: [
                { side: AccountingJournalEntrySide.DEBIT, amount: 400_000 },
                { side: AccountingJournalEntrySide.CREDIT, amount: 390_000 },
              ],
            },
          ],
          paymentClearingEntries: [],
          providerEarning: {
            id: 'earning-broken-1',
            status: EarningStatus.AVAILABLE,
            paidAt: null,
            grossAmount: 400_000,
            netAmount: 300_000,
            currency: 'VND',
            platformFeeLogs: [],
            taxLogs: [],
            walletLedgerEntries: [],
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    const result = await service.verifyBookingSettlementRepair('booking-broken-1');

    expect(result).toMatchObject({
      passed: false,
      status: 'FAILED',
    });
    expect(result.blockingFailures).toEqual(
      expect.arrayContaining([
        'JOURNAL_BALANCED',
        'RECONCILIATION_DELTA_ZERO',
        'PAYMENT_CLEARING_EXPECTATION',
      ]),
    );
  });

  it('rejects settlement repair approval by the acting admin', async () => {
    const service = createAdminService({});

    await expect(
      service.repairBookingSettlementGap('admin-1', 'booking-gap-1', {
        approvalAdminId: 'admin-1',
        reason: 'Restore missing completion settlement',
      }),
    ).rejects.toThrow('Booking settlement repair requires approval from a different admin');
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
        select: expect.objectContaining({
          booking: expect.objectContaining({
            select: expect.objectContaining({
              closedAt: true,
              status: true,
            }),
          }),
          customerProfile: expect.objectContaining({
            select: expect.objectContaining({
              user: expect.objectContaining({
                select: expect.objectContaining({ fullName: true, phone: true }),
              }),
            }),
          }),
          providerProfile: expect.objectContaining({
            select: expect.objectContaining({
              displayName: true,
              user: expect.objectContaining({
                select: expect.objectContaining({ fullName: true, phone: true }),
              }),
            }),
          }),
        }),
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
    const listSelect = prisma.bookingSettlementSnapshot.findMany.mock.calls[0]?.[0]?.select;
    expect(listSelect.booking.select).not.toHaveProperty('createdAt');
    expect(listSelect.booking.select).not.toHaveProperty('scheduledStartAt');
    expect(listSelect.customerProfile.select.user.select).not.toHaveProperty('id');
    expect(listSelect.providerProfile.select.user.select).not.toHaveProperty('id');
    expect(listSelect).not.toHaveProperty('metadata');
  });

  it('keeps the payment fee evidence queue bounded to the selected monthly period', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        findMany: vi.fn().mockResolvedValue([{ id: 'settlement-fee-review-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listBookingSettlementSnapshots({
        period: '2026-07',
        paymentMethod: 'momo',
        range: 'all',
        review: 'payment-fee-evidence',
        take: '25',
      }),
    ).resolves.toEqual([{ id: 'settlement-fee-review-1' }]);

    expect(prisma.bookingSettlementSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          paymentFeePolicyVersionId: true,
          paymentFeeRuleSnapshot: true,
        }),
        take: 25,
        where: {
          AND: [
            { monthlyPeriod: '2026-07' },
            { paymentMethod: PaymentMethod.MOMO },
            {
              OR: [
                { paymentFeePolicyVersionId: null },
                { paymentFeeRuleSnapshot: { path: ['reason'], not: Prisma.JsonNull } },
              ],
            },
          ],
        },
      }),
    );
  });

  it('loads one booking settlement snapshot with the finance audit select', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getBookingSettlementSnapshot('settlement-1')).resolves.toEqual({
      id: 'settlement-1',
    });

    expect(prisma.bookingSettlementSnapshot.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'settlement-1' },
        select: expect.objectContaining({
          accountingJournalBatches: expect.objectContaining({
            take: 3,
          }),
          bookingId: true,
          companyOutputVat: true,
          customerPaymentAmount: true,
          partnerWithholdingTotal: true,
          paymentClearingEntries: expect.objectContaining({
            take: 3,
          }),
          paymentFeeFixedAmount: true,
          paymentFeePayer: true,
          paymentFeePolicyVersionId: true,
          paymentFeeRateBps: true,
          paymentFeeRuleSnapshot: true,
          paymentFeeTreatment: true,
          paymentProcessingFee: true,
          platformFeeGross: true,
          reversalEntries: expect.objectContaining({
            take: 3,
          }),
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

    await expect(
      service.bookingSettlementSnapshotSummary({ range: '30d', review: 'posted' }),
    ).resolves.toEqual({
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
    const listSelect = prisma.bookingSettlementReversalEntry.findMany.mock.calls[0]?.[0]?.select;
    expect(listSelect).not.toHaveProperty('metadata');
    expect(listSelect).not.toHaveProperty('createdAt');
    expect(listSelect).not.toHaveProperty('updatedAt');
    expect(listSelect.originalSettlementSnapshot.select).not.toHaveProperty('booking');
    expect(listSelect.originalSettlementSnapshot.select).not.toHaveProperty('postedAt');
    expect(listSelect.originalSettlementSnapshot.select).not.toHaveProperty('settlementStatus');
    expect(listSelect.originalSettlementSnapshot.select).not.toHaveProperty('taxStatus');
  });

  it('gets a booking settlement reversal detail with reversal evidence only', async () => {
    const prisma = {
      bookingSettlementReversalEntry: {
        findUnique: vi.fn().mockResolvedValue({
          bookingId: 'booking-1',
          id: 'reversal-1',
          originalSettlementSnapshotId: 'settlement-1',
        }),
      },
    };
    const service = createAdminService(prisma) as AdminService & {
      getBookingSettlementReversal: (id: string) => unknown;
    };

    await expect(service.getBookingSettlementReversal('reversal-1')).resolves.toEqual({
      bookingId: 'booking-1',
      id: 'reversal-1',
      originalSettlementSnapshotId: 'settlement-1',
    });

    expect(prisma.bookingSettlementReversalEntry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          accountingJournalBatches: expect.objectContaining({ take: 1 }),
          originalSettlementSnapshot: expect.objectContaining({
            select: expect.objectContaining({
              booking: expect.objectContaining({ select: expect.objectContaining({ status: true }) }),
              id: true,
              postedAt: true,
              settlementStatus: true,
              taxStatus: true,
            }),
          }),
          paymentClearingEntries: expect.objectContaining({ take: 1 }),
        }),
        where: { id: 'reversal-1' },
      }),
    );
    const detailSelect = prisma.bookingSettlementReversalEntry.findUnique.mock.calls[0]?.[0]?.select;
    expect(detailSelect.accountingJournalBatches.select).toEqual(
      expect.objectContaining({
        id: true,
        metadata: true,
        sourceKey: true,
        status: true,
        totalCredit: true,
        totalDebit: true,
      }),
    );
    expect(detailSelect.paymentClearingEntries.select).toEqual(
      expect.objectContaining({
        amount: true,
        bankReconciliationMatches: expect.objectContaining({
          orderBy: { matchedAt: 'desc' },
          select: expect.objectContaining({
            amount: true,
            bankTransaction: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                transferRef: true,
                status: true,
              }),
            }),
            status: true,
          }),
          take: 3,
        }),
        status: true,
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

    await expect(
      service.bookingSettlementReversalSummary({ range: '30d', review: 'non-cash' }),
    ).resolves.toEqual({
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

    const select = prisma.accountingJournalBatch.findMany.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty('metadata');
    expect(select).not.toHaveProperty('createdAt');
    expect(select).not.toHaveProperty('updatedAt');
    expect(select?.booking?.select).toEqual({ status: true });
    expect(select?.customerProfile?.select).not.toHaveProperty('id');
    expect(select?.customerProfile?.select?.user?.select).not.toHaveProperty('id');
    expect(select?.providerProfile?.select).not.toHaveProperty('id');
    expect(select?.providerProfile?.select?.user?.select).not.toHaveProperty('id');
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
        select: expect.objectContaining({
          _count: { select: { bankReconciliationMatches: true } },
          booking: expect.objectContaining({
            select: expect.objectContaining({ status: true }),
          }),
          payment: expect.objectContaining({
            select: expect.objectContaining({
              amount: true,
              currency: true,
              method: true,
              status: true,
            }),
          }),
        }),
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
    const listSelect = prisma.bookingPaymentClearingEntry.findMany.mock.calls[0]?.[0]?.select;
    expect(listSelect).not.toHaveProperty('metadata');
    expect(listSelect).not.toHaveProperty('createdAt');
    expect(listSelect).not.toHaveProperty('updatedAt');
    expect(listSelect.booking.select).not.toHaveProperty('id');
    expect(listSelect.booking.select).not.toHaveProperty('createdAt');
    expect(listSelect.booking.select).not.toHaveProperty('closedAt');
    expect(listSelect.payment.select).not.toHaveProperty('id');
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
          settlementSnapshot: expect.objectContaining({
            select: expect.objectContaining({
              paymentFeeFixedAmount: true,
              paymentFeePayer: true,
              paymentFeePolicyVersionId: true,
              paymentFeeRateBps: true,
              paymentFeeRuleSnapshot: true,
              paymentFeeTreatment: true,
              paymentProcessingFee: true,
            }),
          }),
        }),
      }),
    );
  });

  it('lists active company bank accounts for manual reconciliation imports', async () => {
    const prisma = {
      companyBankAccount: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'bank-account-1', status: CompanyBankAccountStatus.ACTIVE }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listCompanyBankAccounts()).resolves.toEqual([
      { id: 'bank-account-1', status: CompanyBankAccountStatus.ACTIVE },
    ]);

    expect(prisma.companyBankAccount.findMany).toHaveBeenCalledWith({
      where: { status: CompanyBankAccountStatus.ACTIVE },
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
      take: 100,
      select: expect.objectContaining({
        accountNumberLast4: true,
        accountNumberMasked: true,
        bankName: true,
        currency: true,
        id: true,
        name: true,
        status: true,
      }),
    });
  });

  it('creates a masked company bank account with separate approval and audit evidence', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      companyBankAccount: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          accountNumberLast4: '1234',
          accountNumberMasked: '****1234',
          bankName: 'VCB',
          currency: 'VND',
          id: 'bank-account-1',
          name: 'Operations VND',
          status: CompanyBankAccountStatus.ACTIVE,
        }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = createAdminService(prisma);

    await expect(service.createCompanyBankAccount('admin-user-1', {
      accountNumberLast4: '1234',
      accountNumberMasked: ' ****1234 ',
      approvalAdminId: 'finance-admin-2',
      bankName: ' VCB ',
      currency: 'vnd',
      name: ' Operations VND ',
      operatorReason: 'Reviewed treasury account evidence',
    })).resolves.toMatchObject({ id: 'bank-account-1', status: CompanyBankAccountStatus.ACTIVE });

    expect(prisma.companyBankAccount.findFirst).toHaveBeenCalledWith({
      where: {
        accountNumberLast4: '1234',
        bankName: { equals: 'VCB', mode: 'insensitive' },
        currency: 'VND',
        status: { not: CompanyBankAccountStatus.DISABLED },
      },
      select: { id: true },
    });
    expect(prisma.companyBankAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountNumberLast4: '1234',
        accountNumberMasked: '****1234',
        bankName: 'VCB',
        currency: 'VND',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          createdByAdminId: 'admin-user-1',
          operatorReason: 'Reviewed treasury account evidence',
        }),
        name: 'Operations VND',
        status: CompanyBankAccountStatus.ACTIVE,
      }),
      select: expect.objectContaining({ id: true }),
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'company_bank_account.create',
        actorId: 'admin-user-1',
        metadata: expect.objectContaining({ approvalAdminId: 'finance-admin-2' }),
        target: 'company_bank_account:bank-account-1',
      }),
    });
  });

  it('rejects unmasked full company bank account numbers before persistence', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      companyBankAccount: { findFirst: vi.fn(), create: vi.fn() },
    };
    const service = createAdminService(prisma);

    await expect(service.createCompanyBankAccount('admin-user-1', {
      accountNumberLast4: '5678',
      accountNumberMasked: '12345678',
      approvalAdminId: 'finance-admin-2',
      bankName: 'VCB',
      currency: 'VND',
      name: 'Unsafe account',
      operatorReason: 'Reviewed treasury account evidence',
    })).rejects.toThrow('Full bank account numbers must not be stored');
    expect(prisma.companyBankAccount.findFirst).not.toHaveBeenCalled();
    expect(prisma.companyBankAccount.create).not.toHaveBeenCalled();
  });

  it('updates account name and status atomically while retaining before and after audit evidence', async () => {
    const updatedAt = new Date('2026-07-15T01:00:00.000Z');
    const existing = {
      accountNumberLast4: '1234',
      accountNumberMasked: '****1234',
      bankName: 'VCB',
      currency: 'VND',
      id: 'bank-account-1',
      metadata: { createdByAdminId: 'admin-user-0' },
      name: 'Operations VND',
      status: CompanyBankAccountStatus.ACTIVE,
      updatedAt,
      _count: { transactions: 4 },
    };
    const result = {
      accountNumberLast4: '1234',
      accountNumberMasked: '****1234',
      bankName: 'VCB',
      currency: 'VND',
      id: 'bank-account-1',
      name: 'Treasury VND',
      status: CompanyBankAccountStatus.INACTIVE,
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      companyBankAccount: {
        findUnique: vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(result),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = createAdminService(prisma);

    await expect(service.updateCompanyBankAccount('admin-user-1', 'bank-account-1', {
      approvalAdminId: 'finance-admin-2',
      name: ' Treasury VND ',
      operatorReason: 'Archive after treasury owner review',
      status: CompanyBankAccountStatus.INACTIVE,
    })).resolves.toEqual(result);

    expect(prisma.companyBankAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'bank-account-1', updatedAt },
      data: expect.objectContaining({
        name: 'Treasury VND',
        status: CompanyBankAccountStatus.INACTIVE,
        metadata: expect.objectContaining({
          createdByAdminId: 'admin-user-0',
          lastApprovalAdminId: 'finance-admin-2',
          lastOperatorReason: 'Archive after treasury owner review',
          lastUpdatedByAdminId: 'admin-user-1',
        }),
      }),
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'company_bank_account.update',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          before: expect.objectContaining({ name: 'Operations VND', status: CompanyBankAccountStatus.ACTIVE }),
          after: expect.objectContaining({ name: 'Treasury VND', status: CompanyBankAccountStatus.INACTIVE }),
        }),
        target: 'company_bank_account:bank-account-1',
      }),
    });
  });

  it('blocks bank identity changes after transaction history exists', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      companyBankAccount: {
        findUnique: vi.fn().mockResolvedValue({
          accountNumberLast4: '1234',
          accountNumberMasked: '****1234',
          bankName: 'VCB',
          currency: 'VND',
          id: 'bank-account-1',
          metadata: null,
          name: 'Operations VND',
          status: CompanyBankAccountStatus.ACTIVE,
          updatedAt: new Date('2026-07-15T01:00:00.000Z'),
          _count: { transactions: 1 },
        }),
        updateMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.updateCompanyBankAccount('admin-user-1', 'bank-account-1', {
      approvalAdminId: 'finance-admin-2',
      bankName: 'ACB',
      operatorReason: 'Correct bank after treasury review',
    })).rejects.toThrow('Bank identity and currency cannot be changed after transactions exist');
    expect(prisma.companyBankAccount.updateMany).not.toHaveBeenCalled();
  });

  it('lists bank reconciliation transactions with bounded occurrence filters and match counts only', async () => {
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            actor: {
              email: 'master@hands.test',
              fullName: 'Master Admin',
              id: 'master-admin-1',
            },
            actorId: 'master-admin-1',
            createdAt: new Date('2026-07-15T03:00:00.000Z'),
            id: 'assignment-1',
            metadata: {
              assignedAt: '2026-07-15T03:00:00.000Z',
              assignedByAdminId: 'master-admin-1',
              assigneeAdminId: 'finance-operator-1',
              reason: 'Review unmatched bank evidence',
            },
            target: 'bank_transaction:bank-tx-1',
          },
        ]),
      },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([{ id: 'bank-tx-1' }]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            email: 'finance@hands.test',
            fullName: 'Finance Operator',
            id: 'finance-operator-1',
          },
          {
            email: 'master@hands.test',
            fullName: 'Master Admin',
            id: 'master-admin-1',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listBankReconciliationTransactions({
        q: 'VCB-500',
        range: '7d',
        review: 'unmatched',
        skip: '50',
        take: '75',
      }),
    ).resolves.toEqual([
      {
        id: 'bank-tx-1',
        reviewAssignment: {
          assignedAt: '2026-07-15T03:00:00.000Z',
          assignedByAdminId: 'master-admin-1',
          assignee: {
            email: 'finance@hands.test',
            fullName: 'Finance Operator',
            id: 'finance-operator-1',
          },
          assigneeAdminId: 'finance-operator-1',
          reason: 'Review unmatched bank evidence',
        },
      },
    ]);

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
            {
              OR: [
                { transferRef: { contains: 'VCB-500', mode: 'insensitive' } },
                { counterpartyName: { contains: 'VCB-500', mode: 'insensitive' } },
                { description: { contains: 'VCB-500', mode: 'insensitive' } },
                { sourceKey: { contains: 'VCB-500', mode: 'insensitive' } },
              ],
            },
          ]),
        }),
      }),
    );

    const select = prisma.companyBankTransaction.findMany.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty('metadata');
    expect(select).not.toHaveProperty('createdAt');
    expect(select).not.toHaveProperty('updatedAt');
    expect(select?.bankAccount?.select).toEqual(
      expect.objectContaining({
        accountNumberLast4: true,
        accountNumberMasked: true,
        bankName: true,
        currency: true,
        name: true,
      }),
    );
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      distinct: ['target'],
      orderBy: [{ target: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: expect.objectContaining({ target: true }),
      where: {
        action: 'company_bank_transaction.review_assignment',
        target: { in: ['bank_transaction:bank-tx-1'] },
      },
    });
  });

  it('summarizes paid withdrawal candidates for visible outflows in one bounded aggregate query', async () => {
    const transactions = [
      {
        id: 'bank-outflow-strong',
        occurredAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
        status: BankReconciliationStatus.UNMATCHED,
        type: CompanyBankTransactionType.OUTFLOW,
      },
      {
        id: 'bank-outflow-none',
        occurredAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        status: BankReconciliationStatus.PARTIALLY_MATCHED,
        type: CompanyBankTransactionType.OUTFLOW,
      },
      {
        id: 'bank-inflow-ignored-by-candidate-query',
        occurredAt: new Date(),
        status: BankReconciliationStatus.UNMATCHED,
        type: CompanyBankTransactionType.INFLOW,
      },
    ];
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          bankTransactionId: 'bank-outflow-strong',
          candidateCount: 3n,
          strongCount: 1n,
        },
      ]),
      adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue(transactions),
      },
      user: { findMany: vi.fn() },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listBankReconciliationTransactions({ range: '30d', review: 'outflow', take: 10 }),
    ).resolves.toEqual([
      {
        ...transactions[0],
        withdrawalCandidateSummary: {
          candidateCount: 3,
          confidence: 'STRONG',
          reviewCount: 2,
          slaStatus: 'OVER_48H',
          strongCount: 1,
          waitingHours: 50,
        },
      },
      {
        ...transactions[1],
        withdrawalCandidateSummary: {
          candidateCount: 0,
          confidence: 'NONE',
          reviewCount: 0,
          slaStatus: 'OVER_24H',
          strongCount: 0,
          waitingHours: 25,
        },
      },
      transactions[2],
    ]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('COUNT(*) FILTER');
    expect(queryText).toContain('NOT EXISTS');
    expect(queryText).toContain('withdrawalRequestId');
    expect(queryText).toContain('GROUP BY bank."id"');
    expect(query.values).toContain('bank-outflow-strong');
    expect(query.values).toContain('bank-outflow-none');
    expect(query.values).not.toContain('bank-inflow-ignored-by-candidate-query');
    expect(query.values).toContain(ProviderWalletWithdrawalRequestStatus.PAID);
  });

  it('filters withdrawal candidates before pagination and preserves the ranked bank row order', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          bankTransactionId: 'bank-outflow-2',
          candidateCount: 2n,
          reviewAssignedAt: new Date('2026-07-14T03:00:00.000Z'),
          reviewAssignedByAdminId: 'master-admin-1',
          reviewAssigneeAdminId: 'finance-operator-1',
          reviewAssignmentReason: 'Review missing evidence',
          strongCount: 1n,
        },
        { bankTransactionId: 'bank-outflow-1', candidateCount: 1n, strongCount: 1n },
      ]),
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'bank-outflow-1',
            occurredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            status: BankReconciliationStatus.UNMATCHED,
            type: CompanyBankTransactionType.OUTFLOW,
          },
          {
            id: 'bank-outflow-2',
            occurredAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
            status: BankReconciliationStatus.UNMATCHED,
            type: CompanyBankTransactionType.OUTFLOW,
          },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            email: 'finance-operator-1@hands.test',
            fullName: 'Finance Operator One',
            id: 'finance-operator-1',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    const rows = await service.listBankReconciliationTransactions({
      assigneeAdminId: 'finance-operator-1',
      assignment: 'assigned',
      candidate: 'strong',
      q: 'VCB-OUT',
      range: '30d',
      review: 'unmatched',
      skip: 10,
      take: 25,
    });

    expect(rows.map((row) => row.id)).toEqual(['bank-outflow-2', 'bank-outflow-1']);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        reviewAssignment: {
          assignedAt: '2026-07-14T03:00:00.000Z',
          assignedByAdminId: 'master-admin-1',
          assignee: {
            email: 'finance-operator-1@hands.test',
            fullName: 'Finance Operator One',
            id: 'finance-operator-1',
          },
          assigneeAdminId: 'finance-operator-1',
          reason: 'Review missing evidence',
        },
        withdrawalCandidateSummary: {
          candidateCount: 2,
          confidence: 'STRONG',
          reviewCount: 1,
          reviewAssignment: {
            assignedAt: '2026-07-14T03:00:00.000Z',
            assignedByAdminId: 'master-admin-1',
            assignee: {
              email: 'finance-operator-1@hands.test',
              fullName: 'Finance Operator One',
              id: 'finance-operator-1',
            },
            assigneeAdminId: 'finance-operator-1',
            reason: 'Review missing evidence',
          },
          slaStatus: 'OVER_48H',
          strongCount: 1,
          waitingHours: 72,
        },
      }),
    );
    expect(prisma.companyBankTransaction.findMany).toHaveBeenCalledWith({
      select: expect.objectContaining({ id: true }),
      where: { id: { in: ['bank-outflow-2', 'bank-outflow-1'] } },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      select: { email: true, fullName: true, id: true },
      where: { id: { in: ['finance-operator-1'] } },
    });
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string; text?: string; values?: unknown[] };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('WITH withdrawal_candidates AS');
    expect(queryText).toContain('candidates."strongCount" > 0');
    expect(queryText).toContain('ORDER BY candidates."occurredAt" ASC');
    expect(queryText).toContain('LEFT JOIN LATERAL');
    expect(queryText).toContain('OFFSET');
    expect(queryText).toContain('LIMIT');
    expect(query.values).toContain('%VCB-OUT%');
    expect(query.values).toContain('company_bank_transaction.review_assignment');
    expect(query.values).toContain('finance-operator-1');
    expect(query.values).toContain(10);
    expect(query.values).toContain(25);
  });

  it('uses the same withdrawal candidate condition for reconciliation summary totals', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { amount: 900000n, count: 2n, matchedCount: 0n, unmatchedCount: 2n },
      ]),
    };
    const service = createAdminService(prisma);

    await expect(
      service.bankReconciliationSummary({
        assignment: 'unassigned',
        candidate: 'review',
        range: '7d',
        review: 'unmatched',
      }),
    ).resolves.toEqual({
      amount: 900000,
      count: 2,
      currency: 'VND',
      matchedCount: 0,
      unmatchedCount: 2,
    });

    const query = prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string; text?: string };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('candidates."candidateCount" > 0');
    expect(queryText).toContain('candidates."strongCount" = 0');
    expect(queryText).toContain('SUM(candidates."amount")');
    expect(queryText).toContain('IS NULL');
  });

  it('summarizes all withdrawal candidate priorities in one aggregate query', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          assignedCount: 4n,
          assignments: [
            {
              assigneeAdminId: 'finance-operator-1',
              count: 3,
              over24hCount: 2,
              over48hCount: 1,
            },
            {
              assigneeAdminId: 'finance-operator-2',
              count: 1,
              over24hCount: 0,
              over48hCount: 0,
            },
          ],
          eligibleCount: 7n,
          noneAmount: 300000n,
          noneCount: 3n,
          oldestReviewOccurredAt: new Date('2026-07-13T04:00:00.000Z'),
          oldestStrongOccurredAt: new Date('2026-07-12T03:00:00.000Z'),
          reviewAmount: 450000n,
          reviewCount: 2n,
          reviewOver24hCount: 1n,
          reviewOver48hCount: 0n,
          strongAmount: 800000n,
          strongCount: 2n,
          strongOver24hCount: 2n,
          strongOver48hCount: 1n,
          unassignedCount: 3n,
        },
      ]),
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            email: 'finance-operator-1@hands.test',
            fullName: 'Finance Operator One',
            id: 'finance-operator-1',
          },
          {
            email: 'finance-operator-2@hands.test',
            fullName: 'Finance Operator Two',
            id: 'finance-operator-2',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.bankReconciliationWithdrawalCandidateSummary({ q: 'VCB-OUT', range: '30d' }),
    ).resolves.toEqual({
      assignedCount: 4,
      assignments: [
        {
          assignee: {
            email: 'finance-operator-1@hands.test',
            fullName: 'Finance Operator One',
            id: 'finance-operator-1',
          },
          assigneeAdminId: 'finance-operator-1',
          count: 3,
          over24hCount: 2,
          over48hCount: 1,
        },
        {
          assignee: {
            email: 'finance-operator-2@hands.test',
            fullName: 'Finance Operator Two',
            id: 'finance-operator-2',
          },
          assigneeAdminId: 'finance-operator-2',
          count: 1,
          over24hCount: 0,
          over48hCount: 0,
        },
      ],
      currency: 'VND',
      eligibleCount: 7,
      noneAmount: 300000,
      noneCount: 3,
      oldestReviewOccurredAt: '2026-07-13T04:00:00.000Z',
      oldestStrongOccurredAt: '2026-07-12T03:00:00.000Z',
      reviewAmount: 450000,
      reviewCount: 2,
      reviewOver24hCount: 1,
      reviewOver48hCount: 0,
      strongAmount: 800000,
      strongCount: 2,
      strongOver24hCount: 2,
      strongOver48hCount: 1,
      unassignedCount: 3,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      select: { email: true, fullName: true, id: true },
      where: { id: { in: ['finance-operator-1', 'finance-operator-2'] } },
    });
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string; text?: string; values?: unknown[] };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('WITH withdrawal_candidates AS');
    expect(queryText).toContain('COUNT(*) FILTER');
    expect(queryText).toContain('"strongAmount"');
    expect(queryText).toContain('"reviewAmount"');
    expect(queryText).toContain('"noneAmount"');
    expect(queryText).toContain('MIN(candidates."occurredAt")');
    expect(queryText).toContain('assignment_groups');
    expect(queryText).toContain('"unassignedCount"');
    expect(queryText).toContain("INTERVAL '24 hours'");
    expect(queryText).toContain("INTERVAL '48 hours'");
    expect(query.values).toContain('%VCB-OUT%');
  });

  it('keeps the Finance Overview 90-day candidate range instead of falling back to today', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const service = createAdminService(prisma);

    await service.bankReconciliationWithdrawalCandidateSummary({ range: '90d' });

    const query = prisma.$queryRaw.mock.calls[0]?.[0] as { values?: unknown[] };
    const dateBounds = (query.values ?? []).filter((value): value is Date => value instanceof Date);
    expect(dateBounds).toHaveLength(2);
    const spanMs = dateBounds[1].getTime() - dateBounds[0].getTime();
    expect(spanMs).toBeGreaterThanOrEqual(89 * 24 * 60 * 60_000);
    expect(spanMs).toBeLessThanOrEqual(90 * 24 * 60 * 60_000);
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
          metadata: {
            approvalAdminId: 'hidden-create-approver',
            batchImportId: 'batch-import-1',
            ignoreApprovedByAdminId: 'finance-admin-2',
            ignoredAt: '2026-07-14T01:00:00.000Z',
            ignoredByAdminId: 'admin-user-1',
            ignoreReason: 'Duplicate imported statement row',
            importedByAdminId: 'hidden-importer',
            operatorReason: 'Verified statement evidence.',
            sourceFileName: 'vcb-2026-07-14.csv',
          },
          reconciliationMatches: [{ id: 'match-1', amount: 900000 }],
        }),
      },
      adminAuditLog: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              action: 'bank_reconciliation.match.reverse',
              actor: {
                id: 'reversal-maker-3',
                email: 'reversal-maker@hands.test',
                fullName: 'Reversal Maker',
              },
              actorId: 'reversal-maker-3',
              createdAt: new Date('2026-07-14T02:05:00.000Z'),
              metadata: {
                approvalAdminId: 'reversal-approver-3',
                matchId: 'match-1',
                bankStatusBefore: BankReconciliationStatus.MATCHED,
                bankStatusAfter: BankReconciliationStatus.UNMATCHED,
                reason: 'Matched against the wrong clearing source.',
              },
            },
            {
              action: 'bank_reconciliation.match.create',
              actor: {
                id: 'admin-user-1',
                email: 'maker@hands.test',
                fullName: 'Maker Admin',
              },
              actorId: 'admin-user-1',
              createdAt: new Date('2026-07-14T01:05:00.000Z'),
              metadata: {
                approvalAdminId: 'finance-admin-2',
                matchId: 'match-1',
                bankStatusBefore: BankReconciliationStatus.UNMATCHED,
                bankStatusAfter: BankReconciliationStatus.MATCHED,
              },
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'assignment-2',
              actor: {
                id: 'admin-user-1',
                email: 'maker@hands.test',
                fullName: 'Maker Admin',
              },
              actorId: 'admin-user-1',
              createdAt: new Date('2026-07-14T00:30:00.000Z'),
              metadata: {
                assignedAt: '2026-07-14T00:30:00.000Z',
                assigneeAdminId: 'owner-admin-2',
                assignedByAdminId: 'admin-user-1',
                previousAssigneeAdminId: 'owner-admin-1',
                reason: 'Reassigned for Finance closeout.',
              },
            },
          ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'finance-admin-2',
            email: 'approver@hands.test',
            fullName: 'Finance Approver',
          },
          {
            id: 'admin-user-1',
            email: 'maker@hands.test',
            fullName: 'Maker Admin',
          },
          {
            id: 'owner-admin-1',
            email: 'first-owner@hands.test',
            fullName: 'First Owner',
          },
          {
            id: 'owner-admin-2',
            email: 'current-owner@hands.test',
            fullName: 'Current Owner',
          },
          {
            id: 'hidden-create-approver',
            email: 'import-approver@hands.test',
            fullName: 'Import Approver',
          },
          {
            id: 'hidden-importer',
            email: 'importer@hands.test',
            fullName: 'Bank Importer',
          },
          {
            id: 'reversal-approver-3',
            email: 'reversal-approver@hands.test',
            fullName: 'Reversal Approver',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.bankReconciliationTransactionDetail('bank-tx-1')).resolves.toEqual({
      id: 'bank-tx-1',
      creationEvidence: {
        approvalAdmin: {
          email: 'import-approver@hands.test',
          fullName: 'Import Approver',
          id: 'hidden-create-approver',
        },
        approvalAdminId: 'hidden-create-approver',
        batchImportId: 'batch-import-1',
        csvRowNumber: null,
        importedBy: {
          email: 'importer@hands.test',
          fullName: 'Bank Importer',
          id: 'hidden-importer',
        },
        importedByAdminId: 'hidden-importer',
        operatorReason: 'Verified statement evidence.',
        sourceFileName: 'vcb-2026-07-14.csv',
      },
      assignmentHistory: [
        {
          id: 'assignment-2',
          assignedAt: '2026-07-14T00:30:00.000Z',
          assignee: {
            id: 'owner-admin-2',
            email: 'current-owner@hands.test',
            fullName: 'Current Owner',
          },
          assignedBy: {
            id: 'admin-user-1',
            email: 'maker@hands.test',
            fullName: 'Maker Admin',
          },
          previousAssignee: {
            id: 'owner-admin-1',
            email: 'first-owner@hands.test',
            fullName: 'First Owner',
          },
          reason: 'Reassigned for Finance closeout.',
        },
      ],
      ignoreEvidence: {
        approvalAdmin: {
          email: 'approver@hands.test',
          fullName: 'Finance Approver',
          id: 'finance-admin-2',
        },
        approvalAdminId: 'finance-admin-2',
        ignoredAt: '2026-07-14T01:00:00.000Z',
        ignoredBy: {
          email: 'maker@hands.test',
          fullName: 'Maker Admin',
          id: 'admin-user-1',
        },
        ignoredByAdminId: 'admin-user-1',
        reason: 'Duplicate imported statement row',
      },
      reconciliationMatches: [
        {
          id: 'match-1',
          amount: 900000,
          metadata: {
            auditAction: 'bank_reconciliation.match.reverse',
            auditActorEmail: 'reversal-maker@hands.test',
            auditActorId: 'reversal-maker-3',
            auditActorName: 'Reversal Maker',
            auditAt: '2026-07-14T02:05:00.000Z',
            approvalAdminEmail: 'reversal-approver@hands.test',
            approvalAdminId: 'reversal-approver-3',
            approvalAdminName: 'Reversal Approver',
            bankStatusBefore: BankReconciliationStatus.MATCHED,
            bankStatusAfter: BankReconciliationStatus.UNMATCHED,
            matchActorEmail: 'maker@hands.test',
            matchActorId: 'admin-user-1',
            matchActorName: 'Maker Admin',
            matchApprovalAdminEmail: 'approver@hands.test',
            matchApprovalAdminId: 'finance-admin-2',
            matchApprovalAdminName: 'Finance Approver',
            matchAuditAt: '2026-07-14T01:05:00.000Z',
            reversalApprovalAdminEmail: 'reversal-approver@hands.test',
            reversalApprovalAdminId: 'reversal-approver-3',
            reversalApprovalAdminName: 'Reversal Approver',
            reversalReason: 'Matched against the wrong clearing source.',
            reversedAuditAt: '2026-07-14T02:05:00.000Z',
            reversedByAdminEmail: 'reversal-maker@hands.test',
            reversedByAdminId: 'reversal-maker-3',
            reversedByAdminName: 'Reversal Maker',
          },
        },
      ],
      withdrawalCandidates: [],
    });

    expect(prisma.companyBankTransaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bank-tx-1' },
        select: expect.objectContaining({
          metadata: true,
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
    expect(prisma.adminAuditLog.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [
          {
            action: 'bank_reconciliation.match.create',
            target: 'bank_transaction:bank-tx-1',
          },
          {
            action: 'bank_reconciliation.match.reverse',
            target: { in: ['bank_reconciliation_match:match-1'] },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        action: true,
        actorId: true,
        actor: { select: { id: true, email: true, fullName: true } },
        createdAt: true,
        metadata: true,
      },
    });
    expect(prisma.adminAuditLog.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        action: 'company_bank_transaction.review_assignment',
        target: 'bank_transaction:bank-tx-1',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        actorId: true,
        actor: { select: { id: true, email: true, fullName: true } },
        createdAt: true,
        metadata: true,
      },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: expect.arrayContaining([
            'finance-admin-2',
            'owner-admin-2',
            'admin-user-1',
            'owner-admin-1',
            'hidden-create-approver',
            'hidden-importer',
            'reversal-approver-3',
          ]),
        },
      },
      select: { id: true, email: true, fullName: true },
    });
  });

  it('suggests bounded unreconciled paid withdrawals for an outgoing bank transaction', async () => {
    const prisma = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          amount: 500000,
          currency: 'VND',
          id: 'bank-out-1',
          metadata: null,
          occurredAt: new Date('2026-07-15T03:00:00.000Z'),
          reconciliationMatches: [],
          status: BankReconciliationStatus.UNMATCHED,
          transferRef: 'BANK-OUT-500',
          type: CompanyBankTransactionType.OUTFLOW,
        }),
      },
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerWalletWithdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            amount: 500000,
            createdAt: new Date('2026-07-14T03:00:00.000Z'),
            currency: 'VND',
            id: 'withdrawal-strong',
            paidAt: new Date('2026-07-15T02:00:00.000Z'),
            providerProfile: {
              displayName: 'Strong Partner',
              user: { fullName: 'Partner User' },
            },
            providerProfileId: 'provider-1',
            transferRef: 'bank-out-500',
          },
          {
            amount: 520000,
            createdAt: new Date('2026-07-10T03:00:00.000Z'),
            currency: 'VND',
            id: 'withdrawal-review',
            paidAt: new Date('2026-07-10T03:00:00.000Z'),
            providerProfile: {
              displayName: null,
              user: { fullName: 'Review Partner' },
            },
            providerProfileId: 'provider-2',
            transferRef: 'OTHER-REF',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.bankReconciliationTransactionDetail('bank-out-1')).resolves.toMatchObject({
      withdrawalCandidates: [
        {
          amount: 500000,
          amountDelta: 0,
          confidence: 'STRONG',
          exactAmount: true,
          id: 'withdrawal-strong',
          providerLabel: 'Strong Partner',
          transferRefMatch: true,
        },
        {
          amount: 520000,
          amountDelta: 20000,
          confidence: 'REVIEW',
          exactAmount: false,
          id: 'withdrawal-review',
          providerLabel: 'Review Partner',
          transferRefMatch: false,
        },
      ],
    });

    expect(prisma.providerWalletWithdrawalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 25,
        where: expect.objectContaining({
          currency: 'VND',
          status: ProviderWalletWithdrawalRequestStatus.PAID,
          bankReconciliationMatches: {
            none: {
              status: {
                in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED],
              },
            },
          },
        }),
      }),
    );
  });

  it('creates manual company bank transactions with audit evidence for reconciliation', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      companyBankAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-account-1',
          currency: 'VND',
          status: 'ACTIVE',
        }),
      },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'bank-tx-1', amount: 900000 }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.createCompanyBankTransaction('admin-user-1', {
        bankAccountId: 'bank-account-1',
        type: 'INFLOW',
        amount: 900000,
        occurredAt: '2026-06-30T05:00:00.000Z',
        valueDate: '2026-06-30T00:00:00.000Z',
        transferRef: 'VCB-900',
        approvalAdminId: 'finance-admin-2',
        counterpartyName: 'Demo Customer',
        description: 'Manual import from bank statement',
        operatorReason: 'Reviewed against VCB transfer evidence',
      }),
    ).resolves.toEqual({ id: 'bank-tx-1', amount: 900000 });

    expect(prisma.companyBankTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 900000,
        bankAccountId: 'bank-account-1',
        counterpartyName: 'Demo Customer',
        currency: 'VND',
        description: 'Manual import from bank statement',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          duplicateCandidateIds: [],
          duplicateReviewConfirmed: false,
          importedByAdminId: 'admin-user-1',
          manualImport: true,
          operatorReason: 'Reviewed against VCB transfer evidence',
        }),
        occurredAt: new Date('2026-06-30T05:00:00.000Z'),
        sourceKey: 'manual-bank-transaction:bank-account-1:INFLOW:VCB-900',
        transferRef: 'VCB-900',
        type: CompanyBankTransactionType.INFLOW,
        valueDate: new Date('2026-06-30T00:00:00.000Z'),
      }),
      select: expect.objectContaining({ id: true }),
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'company_bank_transaction.manual_create',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          duplicateCandidateIds: [],
          duplicateReviewConfirmed: false,
          operatorReason: 'Reviewed against VCB transfer evidence',
        }),
        target: 'company_bank_transaction:bank-tx-1',
      }),
    });
  });

  it('blocks potential duplicate bank imports until an operator explicitly confirms review', async () => {
    const duplicateCandidate = {
      id: 'bank-tx-existing',
      amount: 900000,
      counterpartyName: 'Demo Customer',
      occurredAt: new Date('2026-06-30T04:58:00.000Z'),
      status: BankReconciliationStatus.UNMATCHED,
      transferRef: 'VCB-899',
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      companyBankAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-account-1',
          currency: 'VND',
          status: CompanyBankAccountStatus.ACTIVE,
        }),
      },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([duplicateCandidate]),
        create: vi.fn().mockResolvedValue({ id: 'bank-tx-new', amount: 900000 }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = createAdminService(prisma);
    const input = {
      approvalAdminId: 'finance-admin-2',
      amount: 900000,
      bankAccountId: 'bank-account-1',
      counterpartyName: 'Demo Customer',
      occurredAt: '2026-06-30T05:00:00.000Z',
      transferRef: 'VCB-900',
      type: CompanyBankTransactionType.INFLOW,
    };

    await expect(service.createCompanyBankTransaction('admin-user-1', input)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BANK_TRANSACTION_POTENTIAL_DUPLICATE',
        candidates: [duplicateCandidate],
      }),
    });
    expect(prisma.companyBankTransaction.create).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();

    await expect(
      service.createCompanyBankTransaction('admin-user-1', {
        ...input,
        confirmPotentialDuplicate: true,
      }),
    ).resolves.toEqual({ id: 'bank-tx-new', amount: 900000 });
    expect(prisma.companyBankTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            duplicateCandidateIds: ['bank-tx-existing'],
            duplicateReviewConfirmed: true,
          }),
        }),
      }),
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'company_bank_transaction.manual_create',
        metadata: expect.objectContaining({
          duplicateCandidateIds: ['bank-tx-existing'],
          duplicateReviewConfirmed: true,
        }),
      }),
    });
  });

  it('classifies bank statement rows without saving and detects duplicates inside the batch', async () => {
    const prisma = {
      companyBankAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-account-1',
          currency: 'VND',
          status: CompanyBankAccountStatus.ACTIVE,
        }),
      },
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    const preview = await service.previewCompanyBankTransactionBatch({
      rows: [
        {
          amount: '900,000',
          bankAccountId: 'bank-account-1',
          occurredAt: '2026-06-30T05:00:00.000Z',
          rowNumber: 1,
          transferRef: 'VCB-CSV-900',
          type: 'INFLOW',
        },
        {
          amount: '900000',
          bankAccountId: 'bank-account-1',
          occurredAt: '2026-06-30T05:05:00.000Z',
          rowNumber: 2,
          transferRef: 'VCB-CSV-900',
          type: 'INFLOW',
        },
        {
          amount: 'invalid',
          bankAccountId: 'bank-account-1',
          occurredAt: '31/02/2026 08:00:00',
          rowNumber: 3,
          type: 'INFLOW',
        },
        {
          amount: '1.250.000 VND',
          bankAccountId: 'bank-account-1',
          occurredAt: '14/07/2026 08:30:15',
          rowNumber: 4,
          transferRef: 'VCB-CSV-1250',
          type: 'INFLOW',
        },
      ],
    });

    expect(preview.summary).toEqual({
      exactDuplicate: 1,
      invalid: 1,
      new: 2,
      potentialDuplicate: 0,
      total: 4,
    });
    expect(preview.rows).toEqual([
      expect.objectContaining({ classification: 'NEW', rowNumber: 1 }),
      expect.objectContaining({
        batchCandidateRowNumbers: [1],
        classification: 'EXACT_DUPLICATE',
        rowNumber: 2,
      }),
      expect.objectContaining({ classification: 'INVALID', rowNumber: 3 }),
      expect.objectContaining({
        classification: 'NEW',
        normalized: expect.objectContaining({
          amount: 1250000,
          occurredAt: '2026-07-14T01:30:15.000Z',
        }),
        rowNumber: 4,
      }),
    ]);
    expect(prisma.companyBankAccount.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.companyBankTransaction.create).not.toHaveBeenCalled();
  });

  it('imports only reviewed valid bank statement rows and skips exact duplicates', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-batch' }) },
    };
    const service = createAdminService(prisma);
    vi.spyOn(service, 'previewCompanyBankTransactionBatch').mockResolvedValue({
      rows: [
        {
          batchCandidateRowNumbers: [],
          candidates: [],
          classification: 'NEW',
          errors: [],
          normalized: {
            amount: 900000,
            bankAccountId: 'bank-account-1',
            counterpartyName: null,
            currency: 'VND',
            description: null,
            occurredAt: '2026-06-30T05:00:00.000Z',
            sourceKey: 'manual-bank-transaction:bank-account-1:INFLOW:VCB-CSV-1',
            transferRef: 'VCB-CSV-1',
            type: CompanyBankTransactionType.INFLOW,
            valueDate: null,
          },
          rowNumber: 1,
        },
        {
          batchCandidateRowNumbers: [],
          candidates: [{ id: 'existing-bank-row' }],
          classification: 'EXACT_DUPLICATE',
          errors: [],
          normalized: {
            amount: 900000,
            bankAccountId: 'bank-account-1',
            counterpartyName: null,
            currency: 'VND',
            description: null,
            occurredAt: '2026-06-30T05:00:00.000Z',
            sourceKey: 'manual-bank-transaction:bank-account-1:INFLOW:VCB-CSV-2',
            transferRef: 'VCB-CSV-2',
            type: CompanyBankTransactionType.INFLOW,
            valueDate: null,
          },
          rowNumber: 2,
        },
      ],
      summary: { exactDuplicate: 1, invalid: 0, new: 1, potentialDuplicate: 0, total: 2 },
    } as never);
    vi.spyOn(service, 'createCompanyBankTransaction').mockResolvedValue({ id: 'bank-tx-imported' } as never);

    const result = await service.importCompanyBankTransactionBatch('admin-user-1', {
      approvalAdminId: 'finance-admin-2',
      mappingPreset: 'VCB',
      operatorReason: 'Reviewed VCB statement rows for import',
      rows: [
        {
          amount: '900000',
          bankAccountId: 'bank-account-1',
          occurredAt: '2026-06-30T05:00:00.000Z',
          rowNumber: 1,
          transferRef: 'VCB-CSV-1',
          type: 'INFLOW',
        },
        {
          amount: '900000',
          bankAccountId: 'bank-account-1',
          occurredAt: '2026-06-30T05:00:00.000Z',
          rowNumber: 2,
          transferRef: 'VCB-CSV-2',
          type: 'INFLOW',
        },
      ],
      sourceFileName: 'C:\\fake-path\\VCB-June.csv',
      sourceFileSha256: 'a'.repeat(64),
    });

    expect(result).toMatchObject({ batchImportId: expect.any(String), importedCount: 1, skippedCount: 1 });
    expect(service.createCompanyBankTransaction).toHaveBeenCalledTimes(1);
    expect(service.createCompanyBankTransaction).toHaveBeenCalledWith(
      'admin-user-1',
      expect.objectContaining({
        approvalAdminId: 'finance-admin-2',
        operatorReason: 'Reviewed VCB statement rows for import',
        transferRef: 'VCB-CSV-1',
      }),
      expect.objectContaining({
        batchImportId: result.batchImportId,
        csvRowNumber: 1,
        mappingPreset: 'VCB',
        sourceFileName: 'VCB-June.csv',
        sourceFileSha256: 'a'.repeat(64),
      }),
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'company_bank_transaction.batch_import',
        metadata: expect.objectContaining({
          batchImportId: result.batchImportId,
          importedCount: 1,
          mappingPreset: 'VCB',
          operatorReason: 'Reviewed VCB statement rows for import',
          requestedCount: 2,
          skippedCount: 1,
          sourceFileName: 'VCB-June.csv',
          sourceFileSha256: 'a'.repeat(64),
        }),
        target: `company_bank_transaction_batch:${result.batchImportId}`,
      }),
    });
  });

  it('lists bounded bank statement import history with operator and approver identities', async () => {
    const createdAt = new Date('2026-07-14T02:00:00.000Z');
    const prisma = {
      adminAuditLog: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            action: 'company_bank_transaction.batch_import',
            actor: { id: 'maker-1', email: 'maker@example.com', fullName: 'Finance Maker', phone: null },
            createdAt,
            id: 'audit-1',
            metadata: {
              approvalAdminId: 'approver-1',
              batchImportId: 'batch-1',
              importedCount: 2,
              mappingPreset: 'VCB',
              requestedCount: 3,
              rowResults: [
                { classification: 'NEW', rowNumber: 2, status: 'IMPORTED', transactionId: 'bank-tx-open' },
                { classification: 'NEW', rowNumber: 3, status: 'IMPORTED', transactionId: 'bank-tx-matched' },
                { classification: 'EXACT_DUPLICATE', rowNumber: 4, status: 'SKIPPED' },
              ],
              skippedCount: 1,
              sourceFileName: 'VCB-July.csv',
              sourceFileSha256: 'b'.repeat(64),
            },
            target: 'company_bank_transaction_batch:batch-1',
          },
        ]),
      },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'bank-tx-open', status: BankReconciliationStatus.UNMATCHED },
          { id: 'bank-tx-matched', status: BankReconciliationStatus.MATCHED },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'approver-1', email: 'approver@example.com', fullName: 'Finance Approver' },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listCompanyBankTransactionImportBatches({ q: 'VCB-July', range: '7d', skip: '0', take: '100' }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          approvalAdminId: 'approver-1',
          approver: { id: 'approver-1', email: 'approver@example.com', fullName: 'Finance Approver' },
          batchImportId: 'batch-1',
          importedCount: 2,
          mappingPreset: 'VCB',
          operator: expect.objectContaining({ id: 'maker-1', fullName: 'Finance Maker' }),
          reconciliationNeedsActionCount: 1,
          reconciliationProgressPercent: 50,
          reconciliationTransactionCount: 2,
          reconciledTransactionCount: 1,
          requestedCount: 3,
          skippedCount: 1,
          sourceFileName: 'VCB-July.csv',
          sourceFileSha256: 'b'.repeat(64),
        }),
      ],
      pagination: { skip: 0, take: 20, total: 1 },
    });
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
    expect(prisma.adminAuditLog.count).toHaveBeenCalledWith({ where: expect.objectContaining({ AND: expect.any(Array) }) });
    const historyWhere = prisma.adminAuditLog.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(historyWhere)).toContain('sourceFileName');
    expect(JSON.stringify(historyWhere)).toContain('VCB-July');
    expect(JSON.stringify(historyWhere)).toContain('createdAt');
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['approver-1'] } },
      select: { id: true, email: true, fullName: true },
    });
    expect(prisma.companyBankTransaction.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['bank-tx-open', 'bank-tx-matched'] } },
      select: { id: true, status: true },
    });
  });

  it('filters bank statement import history by live reconciliation state before pagination', async () => {
    const createdAt = new Date('2026-07-01T02:00:00.000Z');
    const auditLog = {
      action: 'company_bank_transaction.batch_import',
      actor: { id: 'maker-1', email: 'maker@example.com', fullName: 'Finance Maker', phone: null },
      createdAt,
      id: 'audit-open',
      metadata: {
        approvalAdminId: 'approver-1',
        batchImportId: 'batch-open',
        importedCount: 1,
        mappingPreset: 'VCB',
        requestedCount: 1,
        rowResults: [
          { classification: 'NEW', rowNumber: 2, status: 'IMPORTED', transactionId: 'bank-tx-open' },
        ],
        skippedCount: 0,
        sourceFileName: 'VCB-Open.csv',
        sourceFileSha256: 'd'.repeat(64),
      },
      target: 'company_bank_transaction_batch:batch-open',
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'audit-open', total: 1n }]),
      adminAuditLog: {
        count: vi.fn(),
        findMany: vi.fn().mockResolvedValue([auditLog]),
      },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'bank-tx-open', status: BankReconciliationStatus.UNMATCHED },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'approver-1', email: 'approver@example.com', fullName: 'Finance Approver' },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listCompanyBankTransactionImportBatches({
        q: 'VCB',
        range: '30d',
        review: 'needs-reconciliation',
        skip: '0',
        take: '10',
      }),
    ).resolves.toMatchObject({
      items: [
        {
          batchImportId: 'batch-open',
          reconciliationNeedsActionCount: 1,
          reconciliationProgressPercent: 0,
          reconciliationSlaStatus: 'ESCALATE',
          reconciliationWaitingHours: expect.any(Number),
        },
      ],
      pagination: { skip: 0, take: 10, total: 1 },
    });
    expect(prisma.adminAuditLog.count).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['audit-open'] } },
      select: expect.any(Object),
    });
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('reconciliation_batches');
    expect(query.values).toContain(BankReconciliationStatus.UNMATCHED);
    expect(query.values).toContain(BankReconciliationStatus.PARTIALLY_MATCHED);
    expect(queryText).toContain('openCount');
    expect(queryText).toContain('LIMIT');
    expect(queryText).toContain('OFFSET');
  });

  it('lists stale open bank statement import batches oldest first', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: null, total: 0n }]),
      adminAuditLog: {
        count: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      companyBankTransaction: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listCompanyBankTransactionImportBatches({
        range: 'all',
        review: 'stale',
        skip: 0,
        take: 10,
      }),
    ).resolves.toMatchObject({
      items: [],
      pagination: { skip: 0, take: 10, total: 0 },
    });
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('logs."createdAt" <=');
    expect(queryText).toContain('filtered_logs."createdAt" ASC');
    expect(query.values?.some((value) => value instanceof Date)).toBe(true);
  });

  it('lists escalated bank statement imports older than 48 hours first', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: null, total: 0n }]),
      adminAuditLog: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      companyBankTransaction: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = createAdminService(prisma);

    await service.listCompanyBankTransactionImportBatches({
      range: 'all',
      review: 'escalated',
      skip: 0,
      take: 10,
    });
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('logs."createdAt" <=');
    expect(queryText).toContain('filtered_logs."createdAt" ASC');
    expect(query.values?.some((value) => value instanceof Date)).toBe(true);
  });

  it('summarizes open bank statement import batches for the Admin work card', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          batchCount: 6n,
          escalatedNeedsReconciliationCount: 1n,
          needsReconciliationCount: 2n,
          noTransactionCount: 1n,
          oldestOpenImportedAt: new Date('2026-07-01T00:00:00.000Z'),
          reconciledCount: 3n,
          staleNeedsReconciliationCount: 1n,
        },
      ]),
    };
    const service = createAdminService(prisma);

    await expect(service.companyBankTransactionImportBatchSummary()).resolves.toEqual({
      batchCount: 6,
      escalatedNeedsReconciliationCount: 1,
      needsReconciliationCount: 2,
      noTransactionCount: 1,
      oldestOpenImportedAt: new Date('2026-07-01T00:00:00.000Z'),
      reconciledCount: 3,
      staleNeedsReconciliationCount: 1,
    });
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('needsReconciliationCount');
    expect(queryText).toContain('oldestOpenImportedAt');
    expect(queryText).toContain('staleNeedsReconciliationCount');
    expect(queryText).toContain('escalatedNeedsReconciliationCount');
    expect(queryText).toContain('AdminAuditLog');
    expect(query.values).toContain('company_bank_transaction.batch_import');
    expect(query.values?.some((value) => value instanceof Date)).toBe(true);
  });

  it('creates one persistent in-app escalation for an assigned open batch older than 48 hours', async () => {
    const now = new Date('2026-07-14T04:00:00.000Z');
    const importedAt = new Date('2026-07-12T03:00:00.000Z');
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'escalation-audit-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
      },
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ id: 'finance-operator-1' }]),
      },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{
        assigneeAdminId: 'finance-operator-1',
        batchImportId: 'batch-escalate-1',
        importedAt,
        importerAdminId: 'finance-maker-1',
        openTransactionCount: 2n,
      }]),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionImportBatchEscalations(now),
    ).resolves.toEqual({
      escalatedCount: 1,
      missingRecipientCount: 0,
      scannedCount: 1,
      skippedCount: 0,
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'admin.finance.bank_statement_batch.escalated',
        userId: 'finance-operator-1',
      }),
    }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'company_bank_transaction.batch_escalation',
        actorId: 'finance-operator-1',
        metadata: expect.objectContaining({
          notificationId: 'notification-1',
          openTransactionCount: 2,
          source: 'system_sweep',
        }),
        target: 'company_bank_transaction_batch:batch-escalate-1',
      }),
    }));
    expect(tx.user.findFirst).not.toHaveBeenCalled();

    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('reconciliation."openTransactionCount" > 0');
    expect(queryText).toContain('NOT EXISTS');
    expect(queryText).toContain('LIMIT');
    expect(query.values).toContain('company_bank_transaction.batch_escalation');
    expect(query.values).toContain(50);
    expect(
      query.values?.some(
        (value) => value instanceof Date && value.toISOString() === '2026-07-12T04:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('falls back to a Master Admin when an unassigned batch importer is no longer an operator', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'escalation-audit-2' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notification-2' }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'master-admin-1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{
        assigneeAdminId: null,
        batchImportId: 'batch-unassigned-1',
        importedAt: new Date('2026-07-10T00:00:00.000Z'),
        importerAdminId: 'former-admin-1',
        openTransactionCount: 1n,
      }]),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionImportBatchEscalations(
        new Date('2026-07-14T04:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ escalatedCount: 1, missingRecipientCount: 0 });
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'master-admin-1' }),
    }));
  });

  it('rechecks escalation evidence under the database lock before creating a notification', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-escalation-audit' }),
      },
      notification: { create: vi.fn() },
      user: { findFirst: vi.fn(), findMany: vi.fn() },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{
        assigneeAdminId: null,
        batchImportId: 'batch-race-1',
        importedAt: new Date('2026-07-10T00:00:00.000Z'),
        importerAdminId: 'finance-maker-1',
        openTransactionCount: 1n,
      }]),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionImportBatchEscalations(
        new Date('2026-07-14T04:00:00.000Z'),
      ),
    ).resolves.toEqual({
      escalatedCount: 0,
      missingRecipientCount: 0,
      scannedCount: 1,
      skippedCount: 1,
    });
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('creates one in-app escalation for the current assigned bank review after 48 hours', async () => {
    const now = new Date('2026-07-15T04:00:00.000Z');
    const assignedAt = new Date('2026-07-13T03:00:00.000Z');
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'review-escalation-audit-1' }),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'assignment-audit-1',
            metadata: { assigneeAdminId: 'finance-operator-1' },
          })
          .mockResolvedValueOnce(null),
      },
      companyBankTransaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bank-review-1',
          status: BankReconciliationStatus.UNMATCHED,
        }),
      },
      notification: { create: vi.fn().mockResolvedValue({ id: 'notification-review-1' }) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-operator-1' }) },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{
        assigneeAdminId: 'finance-operator-1',
        assignedAt,
        assignmentAuditLogId: 'assignment-audit-1',
        bankTransactionId: 'bank-review-1',
        bankTransactionStatus: BankReconciliationStatus.UNMATCHED,
      }]),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(service.syncCompanyBankTransactionReviewEscalations(now)).resolves.toEqual({
      escalatedCount: 1,
      missingRecipientCount: 0,
      scannedCount: 1,
      skippedCount: 0,
    });
    expect(tx.companyBankTransaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'bank-review-1' }),
    }));
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'admin.finance.bank_transaction.review_escalated',
        userId: 'finance-operator-1',
      }),
    }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'company_bank_transaction.review_escalation',
        metadata: expect.objectContaining({ assignmentAuditLogId: 'assignment-audit-1' }),
        target: 'bank_transaction:bank-review-1',
      }),
    }));
    expect(tx.companyBankTransaction).not.toHaveProperty('update');

    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('latest_assignments');
    expect(queryText).toContain('assignmentAuditLogId');
    expect(queryText).toContain('NOT EXISTS');
    expect(query.values).toContain('company_bank_transaction.review_escalation');
    expect(query.values).toContain(50);
    expect(
      query.values?.some(
        (value) => value instanceof Date && value.toISOString() === '2026-07-13T04:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('skips a review escalation when the same assignment was already escalated', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: {
        create: vi.fn(),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'assignment-audit-1',
            metadata: { assigneeAdminId: 'finance-operator-1' },
          })
          .mockResolvedValueOnce({ id: 'existing-review-escalation' }),
      },
      companyBankTransaction: { findFirst: vi.fn() },
      notification: { create: vi.fn() },
      user: { findFirst: vi.fn() },
    };
    const candidate = {
      assigneeAdminId: 'finance-operator-1',
      assignedAt: new Date('2026-07-10T00:00:00.000Z'),
      assignmentAuditLogId: 'assignment-audit-1',
      bankTransactionId: 'bank-review-1',
      bankTransactionStatus: BankReconciliationStatus.PARTIALLY_MATCHED,
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([candidate]),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionReviewEscalations(
        new Date('2026-07-15T04:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ escalatedCount: 0, skippedCount: 1 });
    expect(tx.adminAuditLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        metadata: { equals: 'assignment-audit-1', path: ['assignmentAuditLogId'] },
      }),
    }));
    expect(tx.companyBankTransaction.findFirst).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('skips a stale review escalation candidate after the transaction is reassigned', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'assignment-audit-new',
          metadata: { assigneeAdminId: 'finance-operator-2' },
        }),
      },
      companyBankTransaction: { findFirst: vi.fn() },
      notification: { create: vi.fn() },
      user: { findFirst: vi.fn() },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{
        assigneeAdminId: 'finance-operator-1',
        assignedAt: new Date('2026-07-10T00:00:00.000Z'),
        assignmentAuditLogId: 'assignment-audit-old',
        bankTransactionId: 'bank-review-1',
        bankTransactionStatus: BankReconciliationStatus.UNMATCHED,
      }]),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionReviewEscalations(
        new Date('2026-07-15T04:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ escalatedCount: 0, skippedCount: 1 });
    expect(tx.adminAuditLog.findFirst).toHaveBeenCalledOnce();
    expect(tx.companyBankTransaction.findFirst).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('escalates an overdue Partner deposit reconciliation without changing finance state', async () => {
    const now = new Date('2026-07-15T04:00:00.000Z');
    const candidate = {
      assigneeAdminId: null,
      assignedAt: null,
      assignmentAuditLogId: null,
      partnerBankDepositRequestId: 'deposit-request-1',
      reviewStartedAt: new Date('2026-07-13T00:00:00.000Z'),
    };
    const tx = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ pg_advisory_xact_lock: null }])
        .mockResolvedValueOnce([]),
      accountingJournalEntry: {
        findFirst: vi.fn().mockResolvedValue({
          amount: 200000,
          bankReconciliationMatches: [{ amount: 50000 }],
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'deposit-escalation-audit-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      notification: { create: vi.fn().mockResolvedValue({ id: 'deposit-escalation-notification-1' }) },
      partnerBankDepositRequest: {
        findFirst: vi.fn().mockResolvedValue({
          amount: 200000,
          bankTransactionId: 'VCB-20260713-001',
          id: 'deposit-request-1',
          journalBatchId: 'journal-1',
        }),
      },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'master-admin-1' }) },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([candidate]),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(service.syncPartnerBankDepositReconciliationEscalations(now)).resolves.toEqual({
      escalatedCount: 1,
      missingRecipientCount: 0,
      scannedCount: 1,
      skippedCount: 0,
    });
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        data: expect.objectContaining({
          financeReviewStatus: 'OPEN',
          partnerBankDepositRequestId: 'deposit-request-1',
        }),
        type: 'admin.finance.partner_bank_deposit.reconciliation_escalated',
        userId: 'master-admin-1',
      }),
    }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'partner_bank_deposit.reconciliation_escalation',
        metadata: expect.objectContaining({ remainingAmount: 150000 }),
        target: 'partner_bank_deposit_request:deposit-request-1',
      }),
    }));
    expect(tx.partnerBankDepositRequest).not.toHaveProperty('update');
    expect(tx.accountingJournalEntry).not.toHaveProperty('update');
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as {
      sql?: string;
      text?: string;
      values?: unknown[];
    };
    const queryText = query.sql ?? query.text ?? '';
    expect(queryText).toContain('openPartnerBankDeposits');
    expect(queryText).toContain('financeReviewStatus');
    expect(queryText).toContain('LIMIT');
    expect(query.values).toContain(50);
  });

  it('resolves a Partner deposit escalation only after bank evidence is fully matched', async () => {
    const resolvedAt = new Date('2026-07-15T05:00:00.000Z');
    const notification = {
      data: {
        bankTransactionId: 'VCB-20260713-001',
        financeReviewStatus: 'OPEN',
        partnerBankDepositRequestId: 'deposit-request-1',
      },
      id: 'deposit-escalation-notification-1',
      type: 'admin.finance.partner_bank_deposit.reconciliation_escalated',
      userId: 'finance-operator-1',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      accountingJournalEntry: {
        findFirst: vi.fn().mockResolvedValue({
          amount: 200000,
          bankReconciliationMatches: [{ amount: 200000 }],
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'deposit-resolution-audit-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      companyBankTransaction: { count: vi.fn(), findUnique: vi.fn() },
      notification: {
        findUnique: vi.fn().mockResolvedValue(notification),
        update: vi.fn().mockResolvedValue({ id: notification.id }),
      },
      partnerBankDepositRequest: {
        findUnique: vi.fn().mockResolvedValue({
          amount: 200000,
          journalBatchId: 'journal-1',
          status: PartnerBankDepositRequestStatus.EXECUTED,
        }),
      },
    };
    const prisma = {
      notification: { findMany: vi.fn().mockResolvedValue([notification]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionReviewEscalationResolutions(resolvedAt),
    ).resolves.toEqual({ openCount: 0, resolvedCount: 1, scannedCount: 1, skippedCount: 0 });
    expect(tx.companyBankTransaction.findUnique).not.toHaveBeenCalled();
    expect(tx.notification.update).toHaveBeenCalledWith({
      where: { id: notification.id },
      data: {
        data: expect.objectContaining({
          financeReviewResolvedAt: resolvedAt.toISOString(),
          financeReviewStatus: 'RESOLVED',
          partnerBankDepositRequestId: 'deposit-request-1',
        }),
      },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'partner_bank_deposit.reconciliation_escalation_resolved',
        metadata: expect.objectContaining({
          notificationId: notification.id,
          partnerBankDepositRequestId: 'deposit-request-1',
        }),
        target: `notification:${notification.id}`,
      }),
    });
  });

  it('moves a resolved bank review escalation to retained history without changing finance data', async () => {
    const resolvedAt = new Date('2026-07-15T05:00:00.000Z');
    const notification = {
      data: {
        bankTransactionId: 'bank-review-1',
        destination: '/finance-tax/bank-reconciliation/bank-review-1',
        financeReviewStatus: 'OPEN',
      },
      id: 'notification-review-1',
      type: 'admin.finance.bank_transaction.review_escalated',
      userId: 'finance-operator-1',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'resolution-audit-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      companyBankTransaction: {
        count: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ status: BankReconciliationStatus.MATCHED }),
      },
      notification: {
        findUnique: vi.fn().mockResolvedValue(notification),
        update: vi.fn().mockResolvedValue({ id: notification.id }),
      },
    };
    const prisma = {
      notification: { findMany: vi.fn().mockResolvedValue([notification]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionReviewEscalationResolutions(resolvedAt),
    ).resolves.toEqual({ openCount: 0, resolvedCount: 1, scannedCount: 1, skippedCount: 0 });
    expect(tx.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-review-1' },
      data: {
        data: expect.objectContaining({
          bankTransactionId: 'bank-review-1',
          financeReviewResolvedAt: resolvedAt.toISOString(),
          financeReviewStatus: 'RESOLVED',
        }),
      },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'company_bank_transaction.review_escalation_resolved',
        actorId: 'finance-operator-1',
        metadata: expect.objectContaining({
          bankTransactionId: 'bank-review-1',
          notificationId: 'notification-review-1',
          source: 'system_sweep',
        }),
        target: 'notification:notification-review-1',
      }),
    });
    expect(tx.companyBankTransaction).not.toHaveProperty('update');
  });

  it('keeps an escalated bank statement batch open while any imported transaction is unresolved', async () => {
    const notification = {
      data: { batchImportId: 'batch-1', financeReviewStatus: 'OPEN' },
      id: 'notification-batch-1',
      type: 'admin.finance.bank_statement_batch.escalated',
      userId: 'finance-operator-1',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      adminAuditLog: { create: vi.fn(), findFirst: vi.fn() },
      companyBankTransaction: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn(),
      },
      notification: {
        findUnique: vi.fn().mockResolvedValue(notification),
        update: vi.fn(),
      },
    };
    const prisma = {
      notification: { findMany: vi.fn().mockResolvedValue([notification]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.syncCompanyBankTransactionReviewEscalationResolutions(
        new Date('2026-07-15T05:00:00.000Z'),
      ),
    ).resolves.toEqual({ openCount: 1, resolvedCount: 0, scannedCount: 1, skippedCount: 0 });
    expect(tx.companyBankTransaction.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        metadata: { equals: 'batch-1', path: ['batchImportId'] },
      }),
    }));
    expect(tx.notification.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('returns read-only bank statement batch rows linked to imported transactions', async () => {
    const createdAt = new Date('2026-07-14T02:00:00.000Z');
    const prisma = {
      adminAuditLog: {
        findFirst: vi.fn().mockResolvedValue({
          action: 'company_bank_transaction.batch_import',
          actor: { id: 'maker-1', email: 'maker@example.com', fullName: 'Finance Maker', phone: null },
          createdAt,
          id: 'audit-1',
          metadata: {
            approvalAdminId: 'approver-1',
            batchImportId: 'batch-1',
            importedCount: 1,
            mappingPreset: 'GENERIC',
            requestedCount: 2,
            rowResults: [
              { classification: 'NEW', rowNumber: 2, status: 'IMPORTED', transactionId: 'bank-tx-1' },
              { classification: 'EXACT_DUPLICATE', rowNumber: 3, status: 'SKIPPED' },
              { classification: 'INVALID', rowNumber: 0, status: 'SKIPPED' },
            ],
            skippedCount: 1,
            sourceFileName: 'statement.csv',
            sourceFileSha256: 'c'.repeat(64),
          },
          target: 'company_bank_transaction_batch:batch-1',
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'batch-assignment-1',
            actorId: 'master-admin-1',
            actor: {
              id: 'master-admin-1',
              email: 'master@example.com',
              fullName: 'Master Admin',
            },
            createdAt: new Date('2026-07-14T03:00:00.000Z'),
            metadata: {
              assigneeAdminId: 'finance-owner-1',
              assignedAt: '2026-07-14T03:00:00.000Z',
              previousAssigneeAdminId: null,
              reason: 'Own the statement reconciliation queue.',
            },
          },
        ]),
      },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            amount: 900000,
            currency: 'VND',
            id: 'bank-tx-1',
            occurredAt: createdAt,
            status: BankReconciliationStatus.UNMATCHED,
            transferRef: 'VCB-1',
            type: CompanyBankTransactionType.INFLOW,
          },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'master-admin-1',
            email: 'master@example.com',
            fullName: 'Master Admin',
          },
          {
            id: 'finance-owner-1',
            email: 'owner@example.com',
            fullName: 'Finance Owner',
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: 'approver-1',
          email: 'approver@example.com',
          fullName: 'Finance Approver',
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.companyBankTransactionImportBatchDetail('batch-1')).resolves.toMatchObject({
      approver: { id: 'approver-1', fullName: 'Finance Approver' },
      assignmentHistory: [
        {
          id: 'batch-assignment-1',
          assignee: { id: 'finance-owner-1', fullName: 'Finance Owner' },
          assignedBy: { id: 'master-admin-1', fullName: 'Master Admin' },
          previousAssignee: null,
          reason: 'Own the statement reconciliation queue.',
        },
      ],
      batchImportId: 'batch-1',
      reconciliationNeedsActionCount: 1,
      reconciliationProgressPercent: 0,
      reconciliationTransactionCount: 1,
      reconciledTransactionCount: 0,
      rows: [
        {
          classification: 'NEW',
          rowNumber: 2,
          status: 'IMPORTED',
          transaction: { id: 'bank-tx-1', amount: 900000 },
          transactionId: 'bank-tx-1',
        },
        {
          classification: 'EXACT_DUPLICATE',
          rowNumber: 3,
          status: 'SKIPPED',
          transaction: null,
          transactionId: null,
        },
      ],
    });
    expect(prisma.companyBankTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['bank-tx-1'] } } }),
    );
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: 'company_bank_transaction.batch_assignment',
        target: 'company_bank_transaction_batch:batch-1',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        actorId: true,
        actor: { select: { id: true, email: true, fullName: true } },
        createdAt: true,
        metadata: true,
      },
    });
  });

  it('assigns an escalated bank statement batch with audit evidence and an in-app notification', async () => {
    const createdAt = new Date('2026-07-01T02:00:00.000Z');
    const baseMetadata = {
      batchImportId: 'batch-assign-1',
      importedCount: 1,
      requestedCount: 1,
      rowResults: [
        { classification: 'NEW', rowNumber: 2, status: 'IMPORTED', transactionId: 'bank-tx-1' },
      ],
      skippedCount: 0,
      sourceFileName: 'statement.csv',
      sourceFileSha256: 'f'.repeat(64),
    };
    const batchLog = {
      action: 'company_bank_transaction.batch_import',
      actor: { id: 'maker-1', email: 'maker@example.com', fullName: 'Finance Maker', phone: null },
      createdAt,
      id: 'audit-batch-1',
      metadata: baseMetadata,
      target: 'company_bank_transaction_batch:batch-assign-1',
    };
    const assignedMetadata = {
      ...baseMetadata,
      assigneeAdminId: 'finance-operator-1',
      assignedAt: '2026-07-14T03:00:00.000Z',
      assignedByAdminId: 'master-admin-1',
    };
    const prisma = {
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'assignment-audit-1' }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn()
          .mockResolvedValueOnce(batchLog)
          .mockResolvedValueOnce({ ...batchLog, metadata: assignedMetadata }),
        update: vi.fn().mockResolvedValue({ ...batchLog, metadata: assignedMetadata }),
      },
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([{
          amount: 900000,
          currency: 'VND',
          id: 'bank-tx-1',
          occurredAt: createdAt,
          status: BankReconciliationStatus.UNMATCHED,
          transferRef: 'VCB-1',
          type: CompanyBankTransactionType.INFLOW,
        }]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({
          adminOperatorPermission: {
            categories: [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
          },
          email: 'operator@example.com',
          fullName: 'Finance Operator',
          id: 'finance-operator-1',
          roles: [Role.ADMIN],
        }),
        findUnique: vi.fn().mockResolvedValue({
          email: 'operator@example.com',
          fullName: 'Finance Operator',
          id: 'finance-operator-1',
        }),
      },
    };
    const notifications = {
      createInApp: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const service = createAdminService(prisma, { notifications });

    await expect(service.assignCompanyBankTransactionImportBatch(
      'master-admin-1',
      'batch-assign-1',
      { assigneeAdminId: 'finance-operator-1', reason: 'Own the overdue queue' },
    )).resolves.toMatchObject({
      assignee: { id: 'finance-operator-1', fullName: 'Finance Operator' },
      assignmentAuditLogId: 'assignment-audit-1',
      batchImportId: 'batch-assign-1',
      notification: { id: 'notification-1', inAppOnly: true },
    });
    expect(prisma.adminAuditLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { metadata: expect.objectContaining({ assigneeAdminId: 'finance-operator-1' }) },
      where: { id: 'audit-batch-1' },
    }));
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'company_bank_transaction.batch_assignment',
        actorId: 'master-admin-1',
      }),
    }));
    expect(notifications.createInApp).toHaveBeenCalledWith(expect.objectContaining({
      type: 'admin.finance.bank_statement_batch.escalated',
      userId: 'finance-operator-1',
    }));
  });

  it('rejects a bank statement batch assignee without reconciliation permission', async () => {
    const prisma = {
      adminAuditLog: { findFirst: vi.fn().mockResolvedValue({ id: 'batch-log-1', metadata: {} }) },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          adminOperatorPermission: { categories: [] },
          email: 'operator@example.com',
          fullName: 'Operator',
          id: 'operator-1',
          roles: [Role.ADMIN],
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.assignCompanyBankTransactionImportBatch(
      'master-admin-1',
      'batch-1',
      { assigneeAdminId: 'operator-1', reason: 'Assign queue owner' },
    )).rejects.toThrow('does not have Bank Reconciliation access');
  });

  it('assigns an open bank transaction review without changing its reconciliation status', async () => {
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'review-assignment-audit-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          status: BankReconciliationStatus.UNMATCHED,
        }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          adminOperatorPermission: {
            categories: [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
          },
          email: 'operator@example.com',
          fullName: 'Finance Operator',
          id: 'finance-operator-1',
          roles: [Role.ADMIN],
        }),
      },
    };
    const notifications = {
      createInApp: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const service = createAdminService(prisma, { notifications });

    await expect(
      service.assignCompanyBankTransactionReview('master-admin-1', 'bank-tx-1', {
        assigneeAdminId: 'finance-operator-1',
        reason: 'Review missing withdrawal evidence',
      }),
    ).resolves.toMatchObject({
      assignee: { id: 'finance-operator-1', fullName: 'Finance Operator' },
      assignmentAuditLogId: 'review-assignment-audit-1',
      bankTransactionId: 'bank-tx-1',
      notification: { id: 'notification-1', inAppOnly: true },
    });
    expect(prisma.companyBankTransaction).not.toHaveProperty('update');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'company_bank_transaction.review_assignment',
        actorId: 'master-admin-1',
        metadata: expect.objectContaining({
          assigneeAdminId: 'finance-operator-1',
          bankStatus: BankReconciliationStatus.UNMATCHED,
          bankTransactionId: 'bank-tx-1',
        }),
        target: 'bank_transaction:bank-tx-1',
      }),
    });
    expect(notifications.createInApp).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'admin.finance.bank_transaction.review_assigned',
        userId: 'finance-operator-1',
      }),
    );
  });

  it('assigns an open Partner deposit reconciliation without changing wallet, bank, or GL state', async () => {
    const prisma = {
      accountingJournalEntry: {
        findFirst: vi.fn().mockResolvedValue({
          amount: 200000,
          bankReconciliationMatches: [{ amount: 50000 }],
        }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'deposit-review-assignment-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      partnerBankDepositRequest: {
        findUnique: vi.fn().mockResolvedValue({
          amount: 200000,
          bankTransactionId: 'VCB-20260715-001',
          id: 'deposit-request-1',
          journalBatchId: 'journal-1',
          status: PartnerBankDepositRequestStatus.EXECUTED,
        }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          adminOperatorPermission: {
            categories: [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
          },
          email: 'operator@example.com',
          fullName: 'Finance Operator',
          id: 'finance-operator-1',
          roles: [Role.ADMIN],
        }),
      },
    };
    const notifications = {
      createInApp: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const service = createAdminService(prisma, { notifications });

    await expect(
      service.assignPartnerBankDepositReconciliationReview('master-admin-1', 'deposit-request-1', {
        assigneeAdminId: 'finance-operator-1',
        reason: 'Own overdue deposit reconciliation',
      }),
    ).resolves.toMatchObject({
      assignee: { id: 'finance-operator-1', fullName: 'Finance Operator' },
      assignmentAuditLogId: 'deposit-review-assignment-1',
      partnerBankDepositRequestId: 'deposit-request-1',
    });
    expect(prisma.partnerBankDepositRequest).not.toHaveProperty('update');
    expect(prisma.accountingJournalEntry).not.toHaveProperty('update');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'partner_bank_deposit.reconciliation_assignment',
        actorId: 'master-admin-1',
        metadata: expect.objectContaining({
          assigneeAdminId: 'finance-operator-1',
          remainingAmount: 150000,
        }),
        target: 'partner_bank_deposit_request:deposit-request-1',
      }),
    });
    expect(notifications.createInApp).toHaveBeenCalledWith(expect.objectContaining({
      type: 'admin.finance.partner_bank_deposit.reconciliation_assigned',
      userId: 'finance-operator-1',
    }));
  });

  it('rejects assignment after a Partner bank deposit is fully reconciled', async () => {
    const prisma = {
      accountingJournalEntry: {
        findFirst: vi.fn().mockResolvedValue({
          amount: 200000,
          bankReconciliationMatches: [{ amount: 200000 }],
        }),
      },
      adminAuditLog: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      partnerBankDepositRequest: {
        findUnique: vi.fn().mockResolvedValue({
          amount: 200000,
          bankTransactionId: 'VCB-20260715-001',
          id: 'deposit-request-1',
          journalBatchId: 'journal-1',
          status: PartnerBankDepositRequestStatus.EXECUTED,
        }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          adminOperatorPermission: {
            categories: [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
          },
          id: 'finance-operator-1',
          roles: [Role.ADMIN],
        }),
      },
    };
    const notifications = { createInApp: vi.fn() };
    const service = createAdminService(prisma, { notifications });

    await expect(
      service.assignPartnerBankDepositReconciliationReview('master-admin-1', 'deposit-request-1', {
        assigneeAdminId: 'finance-operator-1',
        reason: 'Own overdue deposit reconciliation',
      }),
    ).rejects.toThrow('Partner bank deposit is already fully reconciled');
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });

  it('rejects manual company bank transactions without separate finance approval', async () => {
    const prisma = {
      companyBankAccount: {
        findUnique: vi.fn(),
      },
      companyBankTransaction: {
        create: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const service = createAdminService(prisma);
    const input = {
      bankAccountId: 'bank-account-1',
      type: 'INFLOW',
      amount: 900000,
      occurredAt: '2026-06-30T05:00:00.000Z',
      transferRef: 'VCB-900',
    };

    await expect(service.createCompanyBankTransaction('admin-user-1', input)).rejects.toThrow(
      'Company bank transaction manual create requires approval from a different admin',
    );
    await expect(
      service.createCompanyBankTransaction('admin-user-1', {
        ...input,
        approvalAdminId: 'admin-user-1',
      }),
    ).rejects.toThrow('Company bank transaction manual create requires approval from a different admin');
    expect(prisma.companyBankAccount.findUnique).not.toHaveBeenCalled();
    expect(prisma.companyBankTransaction.create).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects manual company bank transactions approved by an admin without finance approver authority', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      companyBankAccount: {
        findUnique: vi.fn(),
      },
      companyBankTransaction: {
        create: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.createCompanyBankTransaction('admin-user-1', {
        bankAccountId: 'bank-account-1',
        type: 'INFLOW',
        amount: 900000,
        occurredAt: '2026-06-30T05:00:00.000Z',
        transferRef: 'VCB-900',
        approvalAdminId: 'support-user-2',
      }),
    ).rejects.toThrow('Company bank transaction manual create requires approval from a finance approver');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(prisma.companyBankAccount.findUnique).not.toHaveBeenCalled();
    expect(prisma.companyBankTransaction.create).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
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
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        amount: 900000,
        approvalAdminId: 'finance-admin-2',
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
          approvalAdminId: 'finance-admin-2',
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

  it('resolves an executed Partner bank deposit request to its bank cash journal debit', async () => {
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 150000,
          currency: 'VND',
          status: BankReconciliationStatus.UNMATCHED,
          type: CompanyBankTransactionType.INFLOW,
        }),
        update: vi.fn().mockResolvedValue({ id: 'bank-tx-1', status: BankReconciliationStatus.MATCHED }),
      },
      partnerBankDepositRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'deposit-request-1',
          status: PartnerBankDepositRequestStatus.EXECUTED,
          journalBatchId: 'deposit-journal-1',
        }),
      },
      accountingJournalEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-cash-entry-1' }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-cash-entry-1',
          amount: 150000,
          currency: 'VND',
          side: AccountingJournalEntrySide.DEBIT,
          accountCode: 'company_bank_cash',
          batch: { sourceType: AccountingJournalSourceType.PROVIDER_BANK_DEPOSIT },
        }),
      },
      bankReconciliationMatch: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValue({ _sum: { amount: 150000 } }),
        create: vi.fn().mockResolvedValue({
          id: 'match-1',
          bankTransactionId: 'bank-tx-1',
          accountingJournalEntryId: 'bank-cash-entry-1',
          amount: 150000,
        }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        partnerBankDepositRequestId: 'deposit-request-1',
        amount: 150000,
        approvalAdminId: 'finance-admin-2',
      }),
    ).resolves.toMatchObject({
      match: { id: 'match-1', accountingJournalEntryId: 'bank-cash-entry-1' },
      bankTransaction: { status: BankReconciliationStatus.MATCHED },
    });

    expect(tx.accountingJournalEntry.findFirst).toHaveBeenCalledWith({
      where: {
        batchId: 'deposit-journal-1',
        side: AccountingJournalEntrySide.DEBIT,
        accountCode: 'company_bank_cash',
      },
      select: { id: true },
    });
    expect(tx.bankReconciliationMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingJournalEntryId: 'bank-cash-entry-1',
        sourceKey: 'bank-reconciliation-match:bank-tx-1:partner-bank-deposit:bank-cash-entry-1',
        metadata: expect.objectContaining({
          sourceType: 'partner-bank-deposit',
          partnerBankDepositRequestId: 'deposit-request-1',
        }),
      }),
    });
  });

  it('rejects Partner bank deposit journals matched to an outflow or non-bank-cash entry', async () => {
    const accountingJournalEntry = {
      findFirst: vi.fn().mockResolvedValue({ id: 'bank-cash-entry-1' }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'bank-cash-entry-1',
        amount: 150000,
        currency: 'VND',
        side: AccountingJournalEntrySide.DEBIT,
        accountCode: 'company_bank_cash',
        batch: { sourceType: AccountingJournalSourceType.PROVIDER_BANK_DEPOSIT },
      }),
    };
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 150000,
          currency: 'VND',
          status: BankReconciliationStatus.UNMATCHED,
          type: CompanyBankTransactionType.OUTFLOW,
        }),
      },
      partnerBankDepositRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'deposit-request-1',
          status: PartnerBankDepositRequestStatus.EXECUTED,
          journalBatchId: 'deposit-journal-1',
        }),
      },
      accountingJournalEntry,
      bankReconciliationMatch: { aggregate: vi.fn(), create: vi.fn() },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        partnerBankDepositRequestId: 'deposit-request-1',
        amount: 150000,
        approvalAdminId: 'finance-admin-2',
      }),
    ).rejects.toThrow('Partner bank deposit journals can only match bank inflows');

    tx.companyBankTransaction.findUnique.mockResolvedValue({
      id: 'bank-tx-1',
      amount: 150000,
      currency: 'VND',
      status: BankReconciliationStatus.UNMATCHED,
      type: CompanyBankTransactionType.INFLOW,
    });
    accountingJournalEntry.findUnique.mockResolvedValue({
      id: 'bank-cash-entry-1',
      amount: 150000,
      currency: 'VND',
      side: AccountingJournalEntrySide.CREDIT,
      accountCode: 'partner_wallet_liability',
      batch: { sourceType: AccountingJournalSourceType.PROVIDER_BANK_DEPOSIT },
    });

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        accountingJournalEntryId: 'bank-cash-entry-1',
        amount: 150000,
        approvalAdminId: 'finance-admin-2',
      }),
    ).rejects.toThrow('Partner bank deposits must match the company bank cash debit entry');
    expect(tx.bankReconciliationMatch.create).not.toHaveBeenCalled();
  });

  it('links a paid Provider withdrawal bank outflow to both the request and its paid bank cash journal', async () => {
    const withdrawal = {
      id: 'withdrawal-1',
      amount: 120000,
      createdAt: new Date('2026-07-13T03:00:00.000Z'),
      currency: 'VND',
      paidAt: new Date('2026-07-14T02:00:00.000Z'),
      status: ProviderWalletWithdrawalRequestStatus.PAID,
      transferRef: 'VCB-OUT-120',
    };
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 120000,
          currency: 'VND',
          occurredAt: new Date('2026-07-14T03:00:00.000Z'),
          status: BankReconciliationStatus.UNMATCHED,
          transferRef: 'vcb-out-120',
          type: CompanyBankTransactionType.OUTFLOW,
        }),
        update: vi.fn().mockResolvedValue({ id: 'bank-tx-1', status: BankReconciliationStatus.MATCHED }),
      },
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(withdrawal),
      },
      accountingJournalEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: 'withdrawal-bank-credit-1' }),
      },
      bankReconciliationMatch: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValue({ _sum: { amount: 120000 } }),
        create: vi.fn().mockResolvedValue({
          id: 'match-1',
          bankTransactionId: 'bank-tx-1',
          accountingJournalEntryId: 'withdrawal-bank-credit-1',
          withdrawalRequestId: 'withdrawal-1',
          amount: 120000,
        }),
      },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        withdrawalRequestId: 'withdrawal-1',
        amount: 120000,
        approvalAdminId: 'finance-admin-2',
      }),
    ).resolves.toMatchObject({
      match: {
        accountingJournalEntryId: 'withdrawal-bank-credit-1',
        withdrawalRequestId: 'withdrawal-1',
      },
      bankTransaction: { status: BankReconciliationStatus.MATCHED },
    });

    expect(tx.accountingJournalEntry.findFirst).toHaveBeenCalledWith({
      where: {
        side: AccountingJournalEntrySide.CREDIT,
        accountCode: 'company_bank_cash',
        batch: {
          sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL,
          sourceId: 'withdrawal-1',
        },
      },
      select: { id: true },
    });
    expect(tx.bankReconciliationMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingJournalEntryId: 'withdrawal-bank-credit-1',
        withdrawalRequestId: 'withdrawal-1',
        sourceKey: 'bank-reconciliation-match:bank-tx-1:withdrawal:withdrawal-1',
        metadata: expect.objectContaining({
          accountingJournalEntryId: 'withdrawal-bank-credit-1',
          sourceType: 'withdrawal',
          withdrawalRecommendationEvidence: expect.objectContaining({
            amountDelta: 0,
            bankTransferRef: 'VCB-OUT-120',
            confidence: 'STRONG',
            dateDeltaDays: 0,
            exactAmount: true,
            rankingVersion: 'withdrawal-candidate-v1',
            source: 'SERVER_RECOMPUTED',
            transferRefMatch: true,
            withdrawalTransferRef: 'VCB-OUT-120',
          }),
        }),
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'bank_reconciliation.match.create',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          withdrawalRequestId: 'withdrawal-1',
          withdrawalRecommendationEvidence: expect.objectContaining({
            confidence: 'STRONG',
            rankingVersion: 'withdrawal-candidate-v1',
            source: 'SERVER_RECOMPUTED',
          }),
        }),
      }),
    });
  });

  it('rejects unpaid Provider withdrawals and bank inflows before reconciliation', async () => {
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 120000,
          currency: 'VND',
          status: BankReconciliationStatus.UNMATCHED,
          type: CompanyBankTransactionType.OUTFLOW,
        }),
      },
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'withdrawal-1',
          amount: 120000,
          currency: 'VND',
          status: ProviderWalletWithdrawalRequestStatus.APPROVED,
        }),
      },
      accountingJournalEntry: { findFirst: vi.fn() },
      bankReconciliationMatch: { aggregate: vi.fn(), create: vi.fn() },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);
    const input = {
      withdrawalRequestId: 'withdrawal-1',
      amount: 120000,
      approvalAdminId: 'finance-admin-2',
    };

    await expect(service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', input)).rejects.toThrow(
      'Only a paid Partner withdrawal can be reconciled',
    );
    expect(tx.accountingJournalEntry.findFirst).not.toHaveBeenCalled();

    tx.providerWalletWithdrawalRequest.findUnique.mockResolvedValue({
      id: 'withdrawal-1',
      amount: 120000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.PAID,
    });
    tx.accountingJournalEntry.findFirst.mockResolvedValue({ id: 'withdrawal-bank-credit-1' });
    tx.companyBankTransaction.findUnique.mockResolvedValue({
      id: 'bank-tx-1',
      amount: 120000,
      currency: 'VND',
      status: BankReconciliationStatus.UNMATCHED,
      type: CompanyBankTransactionType.INFLOW,
    });

    await expect(service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', input)).rejects.toThrow(
      'Partner withdrawals can only match bank outflows',
    );
    expect(tx.bankReconciliationMatch.create).not.toHaveBeenCalled();
  });

  it('rejects direct withdrawal journal matches that bypass the bank outflow cash-credit boundary', async () => {
    const accountingJournalEntry = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'withdrawal-bank-credit-1',
        amount: 120000,
        currency: 'VND',
        side: AccountingJournalEntrySide.CREDIT,
        accountCode: 'company_bank_cash',
        batch: { sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL },
      }),
    };
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 120000,
          currency: 'VND',
          status: BankReconciliationStatus.UNMATCHED,
          type: CompanyBankTransactionType.INFLOW,
        }),
      },
      accountingJournalEntry,
      bankReconciliationMatch: { aggregate: vi.fn(), create: vi.fn() },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);
    const input = {
      accountingJournalEntryId: 'withdrawal-bank-credit-1',
      amount: 120000,
      approvalAdminId: 'finance-admin-2',
    };

    await expect(service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', input)).rejects.toThrow(
      'Partner withdrawal journals can only match bank outflows',
    );

    tx.companyBankTransaction.findUnique.mockResolvedValue({
      id: 'bank-tx-1',
      amount: 120000,
      currency: 'VND',
      status: BankReconciliationStatus.UNMATCHED,
      type: CompanyBankTransactionType.OUTFLOW,
    });
    accountingJournalEntry.findUnique.mockResolvedValue({
      id: 'withdrawal-payable-debit-1',
      amount: 120000,
      currency: 'VND',
      side: AccountingJournalEntrySide.DEBIT,
      accountCode: 'partner_withdrawal_payable',
      batch: { sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL },
    });

    await expect(service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', input)).rejects.toThrow(
      'Partner withdrawals must match the company bank cash credit entry',
    );
    expect(tx.bankReconciliationMatch.create).not.toHaveBeenCalled();
  });

  it('rejects manual bank reconciliation matches without separate finance approval before opening a transaction', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    const service = createAdminService(prisma);
    const input = {
      paymentClearingEntryId: 'clearing-1',
      amount: 900000,
      notes: 'Matched to VCB transfer',
    };

    await expect(service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', input)).rejects.toThrow(
      'Bank reconciliation match requires approval from a different admin',
    );
    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        ...input,
        approvalAdminId: 'admin-user-1',
      }),
    ).rejects.toThrow('Bank reconciliation match requires approval from a different admin');

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects manual bank reconciliation matches approved by an admin without finance approver authority', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        amount: 900000,
        approvalAdminId: 'support-user-2',
        notes: 'Matched to VCB transfer',
      }),
    ).rejects.toThrow('Bank reconciliation match requires approval from a finance approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        amount: 300000,
        approvalAdminId: 'finance-admin-2',
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
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        amount: 300000,
        approvalAdminId: 'finance-admin-2',
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
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.reverseBankReconciliationMatch('admin-user-1', 'bank-tx-1', 'match-1', {
        approvalAdminId: 'finance-admin-2',
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
          approvalAdminId: 'finance-admin-2',
          paymentClearingEntryId: 'clearing-1',
          paymentClearingStatusAfter: BookingPaymentClearingStatus.PARTIALLY_CLEARED,
          reason: 'Wrong payment clearing source',
        }),
      }),
    });
  });

  it('rejects manual bank reconciliation match reversals without separate finance approval before opening a transaction', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    const service = createAdminService(prisma);

    await expect(
      service.reverseBankReconciliationMatch('admin-user-1', 'bank-tx-1', 'match-1', {
        reason: 'Wrong payment clearing source',
      }),
    ).rejects.toThrow('Bank reconciliation match reversal requires approval from a different admin');
    await expect(
      service.reverseBankReconciliationMatch('admin-user-1', 'bank-tx-1', 'match-1', {
        approvalAdminId: 'admin-user-1',
        reason: 'Wrong payment clearing source',
      }),
    ).rejects.toThrow('Bank reconciliation match reversal requires approval from a different admin');

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignores an unmatched bank transaction with separate approval, persistent evidence, and an audit log', async () => {
    const tx = {
      companyBankTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          amount: 500000,
          currency: 'VND',
          metadata: { importedManually: true },
          status: BankReconciliationStatus.UNMATCHED,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'bank-tx-1',
          status: BankReconciliationStatus.IGNORED,
        }),
      },
      bankReconciliationMatch: {
        count: vi.fn().mockResolvedValue(0),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-ignore-1' }),
      },
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.ignoreCompanyBankTransaction('admin-user-1', 'bank-tx-1', {
        approvalAdminId: 'finance-admin-2',
        reason: 'Duplicate statement row imported during reconciliation review',
      }),
    ).resolves.toMatchObject({
      auditLog: { id: 'audit-ignore-1' },
      bankTransaction: { id: 'bank-tx-1', status: BankReconciliationStatus.IGNORED },
    });

    expect(tx.bankReconciliationMatch.count).toHaveBeenCalledWith({
      where: {
        bankTransactionId: 'bank-tx-1',
        status: { in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED] },
      },
    });
    expect(tx.companyBankTransaction.update).toHaveBeenCalledWith({
      where: { id: 'bank-tx-1' },
      data: {
        status: BankReconciliationStatus.IGNORED,
        metadata: expect.objectContaining({
          importedManually: true,
          ignoredByAdminId: 'admin-user-1',
          ignoreApprovedByAdminId: 'finance-admin-2',
          ignoreReason: 'Duplicate statement row imported during reconciliation review',
          ignoredAt: expect.any(String),
        }),
      },
      select: expect.any(Object),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'bank_reconciliation.transaction.ignore',
        target: 'bank_transaction:bank-tx-1',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
          bankStatusBefore: BankReconciliationStatus.UNMATCHED,
          bankStatusAfter: BankReconciliationStatus.IGNORED,
          reason: 'Duplicate statement row imported during reconciliation review',
        }),
      }),
    });
  });

  it('rejects ignore for reconciled bank rows or rows with active matches', async () => {
    const tx = {
      companyBankTransaction: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'bank-tx-1',
            amount: 500000,
            currency: 'VND',
            metadata: null,
            status: BankReconciliationStatus.MATCHED,
          })
          .mockResolvedValueOnce({
            id: 'bank-tx-2',
            amount: 500000,
            currency: 'VND',
            metadata: null,
            status: BankReconciliationStatus.UNMATCHED,
          }),
        update: vi.fn(),
      },
      bankReconciliationMatch: {
        count: vi.fn().mockResolvedValue(1),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = createAdminService(prisma);
    const input = {
      approvalAdminId: 'finance-admin-2',
      reason: 'Duplicate statement row imported during reconciliation review',
    };

    await expect(service.ignoreCompanyBankTransaction('admin-user-1', 'bank-tx-1', input)).rejects.toThrow(
      'Only an unmatched bank transaction can be ignored',
    );
    await expect(service.ignoreCompanyBankTransaction('admin-user-1', 'bank-tx-2', input)).rejects.toThrow(
      'Reverse active reconciliation matches before ignoring this bank transaction',
    );
    expect(tx.companyBankTransaction.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects bank transaction ignore without separate finance approval before opening a transaction', async () => {
    const prisma = {
      user: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    };
    const service = createAdminService(prisma);

    await expect(
      service.ignoreCompanyBankTransaction('admin-user-1', 'bank-tx-1', {
        approvalAdminId: 'admin-user-1',
        reason: 'Duplicate statement row imported during reconciliation review',
      }),
    ).rejects.toThrow('Bank transaction ignore requires approval from a different admin');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects manual bank reconciliation matches with more than one source record', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
      $transaction: vi.fn(),
    };
    const service = createAdminService(prisma);

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', {
        paymentClearingEntryId: 'clearing-1',
        payoutBatchId: 'payout-1',
        approvalAdminId: 'finance-admin-2',
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

  it('casts coupon finance review filters to Postgres enum types in raw SQL', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          bookingServiceAmount: 0n,
          companyCouponExpense: 0n,
          couponDiscountAmount: 0n,
          couponReviewFlagCount: 0n,
          couponSettlementCount: 0n,
          customerPaidAmount: 0n,
          partnerFundedCouponAmount: 0n,
          platformFeeDiscountAmount: 0n,
          reversedCompanyCouponExpense: 0n,
          reversedCouponDiscountAmount: 0n,
          settlementBaseAmount: 0n,
        },
      ]),
      bookingSettlementSnapshot: {
        findMany: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await service.couponFinanceSummary({ review: 'open' });
    await service.couponFinanceSummary({ review: 'posted' });
    await service.couponFinanceSummary({ review: 'cash' });

    const queries = prisma.$queryRaw.mock.calls.map(([query]) => query as { text: string });
    expect(queries[0]?.text).toContain('::"BookingSettlementTaxStatus"');
    expect(queries[1]?.text).toContain('::"BookingSettlementStatus"');
    expect(queries[2]?.text).toContain('::"PaymentMethod"');
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

    await expect(
      service.listPartnerWithholdingTax({ period: '2026-06', skip: '50', take: '25' }),
    ).resolves.toEqual([
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

    await expect(
      service.listMonthlyTaxClosings({ period: '2026-06', skip: '25', take: '25' }),
    ).resolves.toEqual([{ period: '2026-06' }]);

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
        .mockResolvedValueOnce([{
          partnerCountWithRevenue: 1n,
          partnerDepositReconciliationOpenAmount: 250_000n,
          partnerDepositReconciliationOpenCount: 2n,
          paymentFeeReviewFlagCount: 1n,
        }])
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
              paymentProcessingFee: 10000,
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
      paymentProcessingFeeTotal: 10000,
      couponSettlementCount: 1,
      couponDiscountAmountTotal: 60000,
      companyCouponExpenseTotal: 60000,
      partnerFundedCouponAmountTotal: 0,
      platformFeeDiscountAmountTotal: 0,
      couponReviewFlagCount: 1,
      paymentFeeReviewFlagCount: 1,
      partnerDepositReconciliationOpenCount: 2,
      partnerDepositReconciliationOpenAmount: 250000,
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
      remittanceMetadata: null,
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
      accountingJournalBatch: {
        findFirst: vi.fn().mockResolvedValue(null),
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

  it('blocks monthly tax closeout status changes while reconciliation delta remains open', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          companyCouponExpense: 0n,
          couponDiscountAmount: 0n,
          couponReviewFlagCount: 0n,
          couponSettlementCount: 0n,
          partnerFundedCouponAmount: 0n,
          platformFeeDiscountAmount: 0n,
        },
      ]),
      $transaction: vi.fn(),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: MonthlyTaxClosingStatus.REVIEWED,
          declaredAt: null,
          paidAt: null,
          closedAt: null,
          notes: 'Ready',
        }),
      },
      bookingSettlementSnapshot: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({
            _count: { _all: 2 },
            _sum: {
              customerPaymentAmount: 1250000,
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
        notes: 'Attempt close with delta',
      }),
    ).rejects.toThrow('Monthly close requires reconciliation delta to be zero before status can advance');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks declaration while settlement payment fee policy evidence remains unresolved', async () => {
    const prisma = {
      $transaction: vi.fn(),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: MonthlyTaxClosingStatus.REVIEWED,
        }),
      },
      accountingJournalBatch: {
        findFirst: vi.fn(),
      },
    };
    const service = createAdminService(prisma);
    vi.spyOn(service, 'monthlyTaxClosingSummary').mockResolvedValue({
      reconciliationDelta: 0,
      paymentFeeReviewFlagCount: 2,
    } as never);

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.DECLARED,
        notes: 'Attempt declaration before fee policy evidence review',
      }),
    ).rejects.toThrow(
      'Monthly close has 2 settlement(s) without resolved payment fee policy evidence.',
    );

    expect(prisma.accountingJournalBatch.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks declaration while executed Partner bank deposits remain unreconciled', async () => {
    const prisma = {
      $transaction: vi.fn(),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: MonthlyTaxClosingStatus.REVIEWED,
        }),
      },
      accountingJournalBatch: {
        findFirst: vi.fn(),
      },
    };
    const service = createAdminService(prisma);
    vi.spyOn(service, 'monthlyTaxClosingSummary').mockResolvedValue({
      reconciliationDelta: 0,
      paymentFeeReviewFlagCount: 0,
      partnerDepositReconciliationOpenCount: 2,
    } as never);

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.DECLARED,
        notes: 'Attempt declaration before bank evidence matching',
      }),
    ).rejects.toThrow(
      'Monthly close has 2 executed Partner bank deposit(s) without complete bank reconciliation.',
    );

    expect(prisma.accountingJournalBatch.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks monthly tax closeout status changes while posted journal reconciliation deltas remain open', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          companyCouponExpense: 0n,
          couponDiscountAmount: 0n,
          couponReviewFlagCount: 0n,
          couponSettlementCount: 0n,
          partnerCountWithRevenue: 1n,
          partnerFundedCouponAmount: 0n,
          platformFeeDiscountAmount: 0n,
        },
      ]),
      $transaction: vi.fn(),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: MonthlyTaxClosingStatus.REVIEWED,
          declaredAt: null,
          paidAt: null,
          closedAt: null,
          notes: 'Ready',
        }),
      },
      accountingJournalBatch: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'journal-imbalanced-1',
          sourceKey: 'accounting-journal:booking-settlement:booking-1',
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
        groupBy: vi.fn().mockResolvedValue([{ providerProfileId: 'provider-1' }]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.DECLARED,
        notes: 'Attempt close with journal delta',
      }),
    ).rejects.toThrow(
      'Monthly close requires posted journal reconciliation deltas to be cleared before status can advance.',
    );

    expect(prisma.accountingJournalBatch.findFirst).toHaveBeenCalledWith({
      where: {
        monthlyPeriod: '2026-06',
        status: AccountingJournalBatchStatus.POSTED,
        metadata: {
          path: ['reconciliationDelta'],
          not: 0,
        },
      },
      select: { id: true, sourceKey: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires separate approval and evidence before marking partner withholding remittance paid', async () => {
    const prisma = {
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: MonthlyTaxClosingStatus.DECLARED,
          declaredAt: new Date('2026-06-30T10:00:00.000Z'),
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
        status: MonthlyTaxClosingStatus.PAID,
        remittanceTransferRef: 'VCB-TAX-202606',
        remittanceEvidenceUrl: 'https://evidence.example/remittance.pdf',
      } as never),
    ).rejects.toThrow(
      'Partner withholding remittance paid closeout requires approval from a different admin',
    );

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.PAID,
        approvalAdminId: 'admin-1',
        remittanceTransferRef: 'VCB-TAX-202606',
        remittanceEvidenceUrl: 'https://evidence.example/remittance.pdf',
      } as never),
    ).rejects.toThrow(
      'Partner withholding remittance paid closeout requires approval from a different admin',
    );

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.PAID,
        approvalAdminId: 'finance-admin-2',
        remittanceTransferRef: 'VCB-TAX-202606',
      } as never),
    ).rejects.toThrow('Partner withholding remittance evidence URL is required before marking paid.');

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.PAID,
        approvalAdminId: 'finance-admin-2',
        remittanceEvidenceUrl: 'https://evidence.example/remittance.pdf',
      } as never),
    ).rejects.toThrow('Partner withholding remittance transfer reference is required before marking paid.');
    expect(prisma.bookingSettlementSnapshot.aggregate).not.toHaveBeenCalled();
  });

  it('rejects partner withholding remittance paid closeout approved by an admin without finance approver authority', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: MonthlyTaxClosingStatus.DECLARED,
          declaredAt: new Date('2026-06-30T10:00:00.000Z'),
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
        status: MonthlyTaxClosingStatus.PAID,
        approvalAdminId: 'support-user-2',
        remittanceTransferRef: 'VCB-TAX-202606',
        remittanceEvidenceUrl: 'https://evidence.example/remittance.pdf',
      } as never),
    ).rejects.toThrow(
      'Partner withholding remittance paid closeout requires approval from a finance approver',
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(prisma.bookingSettlementSnapshot.aggregate).not.toHaveBeenCalled();
  });

  it('stores partner withholding remittance evidence when closing status moves to paid', async () => {
    const existingClosing = {
      id: 'closing-1',
      period: '2026-06',
      currency: 'VND',
      status: MonthlyTaxClosingStatus.DECLARED,
      declaredAt: new Date('2026-06-30T10:00:00.000Z'),
      paidAt: null,
      closedAt: null,
      notes: 'Declared',
      remittanceMetadata: null,
    };
    const paidAt = new Date('2026-07-01T04:30:00.000Z');
    const updatedClosing = {
      ...existingClosing,
      status: MonthlyTaxClosingStatus.PAID,
      paidAt,
      notes: 'Paid through tax portal',
      remittanceMetadata: {
        transferRef: 'VCB-TAX-202606',
        channel: 'VCB_MANUAL_TRANSFER',
        evidenceUrl: 'https://evidence.example/remittance.pdf',
        paidAt: paidAt.toISOString(),
        remittedByAdminId: 'admin-1',
        approvedByAdminId: 'finance-admin-2',
      },
    };
    const tx = {
      monthlyTaxClosing: {
        upsert: vi.fn().mockResolvedValue(updatedClosing),
      },
      bookingSettlementSnapshot: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'withholding-remittance-journal-1' }),
      },
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          companyCouponExpense: 0n,
          couponDiscountAmount: 0n,
          couponReviewFlagCount: 0n,
          couponSettlementCount: 0n,
          partnerFundedCouponAmount: 0n,
          platformFeeDiscountAmount: 0n,
        },
      ]),
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue(existingClosing),
      },
      accountingJournalBatch: {
        findFirst: vi.fn().mockResolvedValue(null),
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
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(2),
        groupBy: vi.fn(),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.updateMonthlyTaxClosingStatus('admin-1', '2026-06', {
        status: MonthlyTaxClosingStatus.PAID,
        notes: ' Paid through tax portal ',
        paidAt: paidAt.toISOString(),
        approvalAdminId: ' finance-admin-2 ',
        remittanceTransferRef: ' VCB-TAX-202606 ',
        remittanceChannel: ' VCB_MANUAL_TRANSFER ',
        remittanceEvidenceUrl: ' https://evidence.example/remittance.pdf ',
      } as never),
    ).resolves.toEqual(updatedClosing);

    expect(tx.monthlyTaxClosing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: MonthlyTaxClosingStatus.PAID,
          paidAt,
          paidById: 'admin-1',
          remittanceMetadata: expect.objectContaining({
            transferRef: 'VCB-TAX-202606',
            channel: 'VCB_MANUAL_TRANSFER',
            evidenceUrl: 'https://evidence.example/remittance.pdf',
            paidAt: paidAt.toISOString(),
            remittedByAdminId: 'admin-1',
            approvedByAdminId: 'finance-admin-2',
          }),
        }),
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
        taxStatus: BookingSettlementTaxStatus.PAID,
      },
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:withholding-remittance:2026-06:VND' },
      update: expect.objectContaining({
        currency: 'VND',
        monthlyPeriod: '2026-06',
        sourceId: 'closing-1',
        sourceType: AccountingJournalSourceType.WITHHOLDING_REMITTANCE,
        status: AccountingJournalBatchStatus.POSTED,
        totalCredit: 84000,
        totalDebit: 84000,
      }),
      create: expect.objectContaining({
        currency: 'VND',
        monthlyPeriod: '2026-06',
        sourceKey: 'accounting-journal:withholding-remittance:2026-06:VND',
        sourceId: 'closing-1',
        sourceType: AccountingJournalSourceType.WITHHOLDING_REMITTANCE,
        status: AccountingJournalBatchStatus.POSTED,
        totalCredit: 84000,
        totalDebit: 84000,
      }),
    });
    const remittanceJournalUpdateEntries = tx.accountingJournalBatch.upsert.mock.calls[0]?.[0].update.entries;
    expect(Object.keys(remittanceJournalUpdateEntries)).toEqual(['deleteMany', 'create']);
    expect(tx.accountingJournalBatch.upsert.mock.calls[0]?.[0].create.entries.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'partner_vat_pit_payable',
          amount: 84000,
          side: 'DEBIT',
        }),
        expect.objectContaining({
          accountCode: 'company_bank_cash',
          amount: 84000,
          side: 'CREDIT',
        }),
      ]),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'monthly_tax_closing.status_update',
        metadata: expect.objectContaining({
          toStatus: MonthlyTaxClosingStatus.PAID,
          partnerWithholdingTotal: 84000,
          remittance: expect.objectContaining({
            transferRef: 'VCB-TAX-202606',
            channel: 'VCB_MANUAL_TRANSFER',
            approvedByAdminId: 'finance-admin-2',
          }),
        }),
      }),
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
      $queryRaw: vi.fn().mockResolvedValue([
        {
          paymentMethod: PaymentMethod.CASH,
          settlementCount: 1n,
          evidenceReviewCount: 1n,
          customerPaymentAmountTotal: 600000n,
          evidenceCustomerPaymentAmountTotal: 600000n,
          paymentProcessingFeeTotal: 0n,
          evidenceRecordedFeeTotal: 0n,
          remediationExpectedFeeTotal: 0n,
        },
        {
          paymentMethod: PaymentMethod.MOMO,
          settlementCount: 1n,
          evidenceReviewCount: 1n,
          customerPaymentAmountTotal: 600000n,
          evidenceCustomerPaymentAmountTotal: 600000n,
          paymentProcessingFeeTotal: 10000n,
          evidenceRecordedFeeTotal: 10000n,
          remediationExpectedFeeTotal: 12000n,
        },
      ]),
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
      paymentFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'payment-fee-policy-2026',
          name: 'HANDS payment fee policy',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
          rules: [
            {
              id: 'payment-fee-rule-cash',
              method: PaymentMethod.CASH,
              feeType: 'RATE',
              rateBps: 0,
              fixedAmount: 0,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
            {
              id: 'payment-fee-rule-momo',
              method: PaymentMethod.MOMO,
              feeType: 'RATE',
              rateBps: 200,
              fixedAmount: 0,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
          ],
        }),
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
          evidenceReviewCount: 1,
          customerPaymentAmountTotal: 600000,
          evidenceCustomerPaymentAmountTotal: 600000,
          paymentProcessingFeeTotal: 0,
          evidenceRecordedFeeTotal: 0,
          remediationExpectedFeeTotal: null,
          remediationDelta: null,
        },
        {
          paymentMethod: PaymentMethod.MOMO,
          settlementCount: 1,
          evidenceReviewCount: 1,
          customerPaymentAmountTotal: 600000,
          evidenceCustomerPaymentAmountTotal: 600000,
          paymentProcessingFeeTotal: 10000,
          evidenceRecordedFeeTotal: 10000,
          remediationExpectedFeeTotal: null,
          remediationDelta: null,
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
      policyReadiness: {
        activePolicy: {
          id: 'payment-fee-policy-2026',
          name: 'HANDS payment fee policy',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
          rules: [
            {
              id: 'payment-fee-rule-cash',
              method: PaymentMethod.CASH,
              feeType: 'RATE',
              rateBps: 0,
              fixedAmount: 0,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
            {
              id: 'payment-fee-rule-momo',
              method: PaymentMethod.MOMO,
              feeType: 'RATE',
              rateBps: 200,
              fixedAmount: 0,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
          ],
        },
        configuredMethods: [PaymentMethod.CASH, PaymentMethod.MOMO],
        missingMethods: [
          PaymentMethod.VNPAY,
          PaymentMethod.CARD,
          PaymentMethod.BANK_TRANSFER,
          PaymentMethod.CUSTOMER_WALLET,
          PaymentMethod.MANUAL,
        ],
        status: 'MISSING_METHOD_RULES',
      },
      remediationPreview: {
        status: 'BLOCKED',
        policyVersionId: 'payment-fee-policy-2026',
        blockers: [
          { code: 'MISSING_METHOD_RULE', message: 'Historical preview requires exactly one active VNPAY rule.' },
          { code: 'MISSING_METHOD_RULE', message: 'Historical preview requires exactly one active CARD rule.' },
          { code: 'MISSING_METHOD_RULE', message: 'Historical preview requires exactly one active BANK_TRANSFER rule.' },
          { code: 'MISSING_METHOD_RULE', message: 'Historical preview requires exactly one active CUSTOMER_WALLET rule.' },
          { code: 'MISSING_METHOD_RULE', message: 'Historical preview requires exactly one active MANUAL rule.' },
        ],
        evidenceReviewCount: 2,
        evidenceCustomerPaymentAmountTotal: 1200000,
        recordedFeeTotal: 10000,
        expectedFeeTotal: null,
        delta: null,
      },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.paymentFeePolicyVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ rules: expect.any(Object) }),
        where: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('reports an explicit readiness failure when no active payment fee policy exists', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      bookingSettlementSnapshot: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { customerPaymentAmount: null, paymentProcessingFee: null },
        }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      paymentFeePolicyVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = createAdminService(prisma);

    await expect(service.paymentFeeSummary({ period: '2026-07' })).resolves.toMatchObject({
      policyReadiness: {
        activePolicy: null,
        configuredMethods: [],
        missingMethods: [
          PaymentMethod.MOMO,
          PaymentMethod.VNPAY,
          PaymentMethod.CASH,
          PaymentMethod.CARD,
          PaymentMethod.BANK_TRANSFER,
          PaymentMethod.CUSTOMER_WALLET,
          PaymentMethod.MANUAL,
        ],
        status: 'MISSING_ACTIVE_POLICY',
      },
    });
    expect(prisma.bookingSettlementSnapshot.groupBy).toHaveBeenCalledTimes(2);
  });

  it('exposes historical payment fee differences only when policy coverage is complete', async () => {
    const rules = Object.values(PaymentMethod).map((method) => ({
      id: `rule-${method.toLowerCase()}`,
      method,
      feeType: PaymentFeeRuleType.RATE,
      rateBps: method === PaymentMethod.CARD ? 150 : 0,
      fixedAmount: 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
    }));
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          paymentMethod: PaymentMethod.CARD,
          settlementCount: 2n,
          evidenceReviewCount: 2n,
          customerPaymentAmountTotal: 2000000n,
          evidenceCustomerPaymentAmountTotal: 2000000n,
          paymentProcessingFeeTotal: 0n,
          evidenceRecordedFeeTotal: 0n,
          remediationExpectedFeeTotal: 30000n,
        },
      ]),
      bookingSettlementSnapshot: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: { customerPaymentAmount: 2000000, paymentProcessingFee: 0 },
        }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      paymentFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'policy-complete',
          name: 'Approved gateway contract',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-05-31T17:00:00.000Z'),
          effectiveTo: null,
          rules,
        }),
      },
    };
    const service = createAdminService(prisma);

    const result = await service.paymentFeeSummary({ period: '2026-06' });

    expect(result.remediationPreview).toEqual({
      status: 'READY',
      policyVersionId: 'policy-complete',
      blockers: [],
      evidenceReviewCount: 2,
      evidenceCustomerPaymentAmountTotal: 2000000,
      recordedFeeTotal: 0,
      expectedFeeTotal: 30000,
      delta: 30000,
    });
    expect(result.byPaymentMethod[0]).toMatchObject({
      paymentMethod: PaymentMethod.CARD,
      remediationExpectedFeeTotal: 30000,
      remediationDelta: 30000,
    });
  });

  it('keeps payment fee policy history bounded', async () => {
    const prisma = {
      paymentFeePolicyVersion: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = createAdminService(prisma);

    await service.listPaymentFeePolicies({ take: '500' });

    expect(prisma.paymentFeePolicyVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, select: expect.any(Object) }),
    );
  });

  it('builds a bounded finance approval queue from persisted pending wallet requests', async () => {
    const requestedAt = new Date('2026-07-13T08:00:00.000Z');
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValueOnce([
        {
          actorEmail: 'maker@example.test',
          actorFullName: 'Policy Maker',
          actorId: 'maker-admin',
          effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
          metadata: {
            reason: 'Review the gateway contract',
            requestedBy: {
              id: 'maker-admin',
              email: 'maker@example.test',
              fullName: 'Policy Maker',
            },
          },
          policyId: 'policy-draft',
          policyName: 'August gateway fees',
          policyUpdatedAt: new Date('2026-07-13T07:00:00.000Z'),
          requestedAt,
          requestId: 'approval-request-1',
          totalCount: 2n,
        },
        ])
        .mockResolvedValueOnce([
          {
            id: 'wallet-request-1',
            ownerType: 'PARTNER',
            ownerId: 'provider-1',
            ownerName: 'Partner One',
            direction: 'CREDIT',
            adjustmentType: 'PARTNER_BONUS',
            amount: 200000,
            currency: 'VND',
            reason: 'Recovery bonus',
            monthlyPeriod: '2026-07',
            attachmentUrl: null,
            requestedBeforeBalance: 0,
            requestedAfterBalance: 200000,
            requiresAttachment: false,
            requestedByAdminId: 'maker-admin',
            requesterFullName: 'Wallet Maker',
            requesterEmail: 'wallet-maker@example.test',
            createdAt: requestedAt,
            totalCount: 3n,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'deposit-request-1',
            providerProfileId: 'provider-1',
            partnerName: 'Partner One',
            amount: 1000000,
            currency: 'VND',
            bankTransactionId: 'BIDV-20260713-001',
            depositDate: requestedAt,
            bankAccount: 'BIDV settlement account',
            attachmentFileId: 'evidence-1',
            attachmentUrl: null,
            notes: 'Bank evidence confirmed',
            requestedBeforeBalance: -170000,
            requestedAfterBalance: 830000,
            requestedReceivableRecovery: 170000,
            requestedWalletLiabilityIncrease: 830000,
            requestedByAdminId: 'deposit-maker',
            requesterFullName: 'Deposit Maker',
            requesterEmail: 'deposit-maker@example.test',
            createdAt: requestedAt,
            totalCount: 1n,
          },
        ]),
      providerWalletWithdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'withdrawal-1',
            providerProfileId: 'provider-1',
            bankAccountId: null,
            amount: 400000,
            currency: 'VND',
            status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
            createdAt: requestedAt,
            updatedAt: requestedAt,
            providerProfile: {
              displayName: 'Partner One',
              user: { fullName: 'Partner Legal Name' },
            },
          },
        ]),
        groupBy: vi.fn().mockResolvedValue([
          {
            status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
            _count: { _all: 3 },
            _sum: { amount: 900000 },
          },
          {
            status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
            _count: { _all: 1 },
            _sum: { amount: 500000 },
          },
        ]),
      },
      customerWalletLedgerEntry: { count: vi.fn().mockResolvedValue(2) },
      providerWalletLedgerEntry: { count: vi.fn().mockResolvedValue(4) },
      partnerBankDepositRequest: { count: vi.fn().mockResolvedValue(2) },
    };
    const service = createAdminService(prisma);

    await expect(service.financeApprovalQueue({ take: '500' })).resolves.toMatchObject({
      limit: 25,
      summary: {
        paymentFeePolicyPendingCount: 2,
        withdrawalOpenCount: 4,
        withdrawalRequestedCount: 3,
        withdrawalBankTransferPendingCount: 1,
        withdrawalOpenAmount: 1400000,
        walletAdjustmentLast7dCount: 6,
        walletAdjustmentPendingCount: 3,
        partnerBankDepositPendingCount: 1,
        partnerBankDepositLast7dCount: 2,
      },
      paymentFeePolicyRequests: [
        expect.objectContaining({
          policyId: 'policy-draft',
          reason: 'Review the gateway contract',
          requestedBy: expect.objectContaining({ id: 'maker-admin' }),
        }),
      ],
      withdrawalRequests: [
        expect.objectContaining({
          id: 'withdrawal-1',
          partnerName: 'Partner One',
          hasBankAccount: false,
        }),
      ],
      walletAdjustmentEvidence: {
        last7dCount: 6,
        pendingQueueSupported: true,
      },
      walletAdjustmentRequests: [
        expect.objectContaining({
          id: 'wallet-request-1',
          ownerName: 'Partner One',
          requestedBy: expect.objectContaining({ id: 'maker-admin' }),
        }),
      ],
      partnerBankDepositRequests: [
        expect.objectContaining({
          id: 'deposit-request-1',
          requestedReceivableRecovery: 170000,
          requestedWalletLiabilityIncrease: 830000,
          requestedBy: expect.objectContaining({ id: 'deposit-maker' }),
        }),
      ],
    });
    expect(prisma.providerWalletWithdrawalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
    expect(prisma.customerWalletLedgerEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: expect.any(Object) }) }),
    );
  });

  it('preflights a complete payment fee draft with the production settlement rounding rule', async () => {
    const rules = Object.values(PaymentMethod).map((method) => ({
      id: `rule-${method}`,
      active: true,
      method,
      feeType: method === PaymentMethod.CARD ? PaymentFeeRuleType.RATE_PLUS_FIXED : PaymentFeeRuleType.RATE,
      rateBps: method === PaymentMethod.CARD ? 155 : 0,
      fixedAmount: method === PaymentMethod.CARD ? 99 : 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
    const prisma = {
      paymentFeePolicyVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'policy-ready',
          status: 'DRAFT',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
          notes: 'Gateway contract GF-2026-01 and signed pricing schedule',
          rules,
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.paymentFeePolicyPreflight('policy-ready', { sampleAmount: '100050' }),
    ).resolves.toMatchObject({
      policyId: 'policy-ready',
      policyStatus: 'DRAFT',
      sampleAmount: 100050,
      currency: 'VND',
      readyForActivation: true,
      blockers: [],
      coverage: {
        requiredMethods: 7,
        configuredMethods: 7,
        missingMethods: [],
        duplicateMethods: [],
        invalidMethods: [],
      },
      rules: expect.arrayContaining([
        expect.objectContaining({
          method: PaymentMethod.CARD,
          estimatedFeeAmount: 1650,
          status: 'READY',
        }),
      ]),
    });
    expect(prisma.paymentFeePolicyVersion.findUnique).toHaveBeenCalledWith({
      where: { id: 'policy-ready' },
      select: expect.any(Object),
    });
  });

  it('reports activation blockers for incomplete, duplicate, and invalid payment fee rules', async () => {
    const prisma = {
      paymentFeePolicyVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'policy-blocked',
          status: 'DRAFT',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
          rules: [
            {
              active: true,
              method: PaymentMethod.MOMO,
              feeType: PaymentFeeRuleType.RATE,
              rateBps: 100,
              fixedAmount: 0,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
            {
              active: true,
              method: PaymentMethod.MOMO,
              feeType: PaymentFeeRuleType.FIXED,
              rateBps: 0,
              fixedAmount: 1000,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
            {
              active: true,
              method: PaymentMethod.CARD,
              feeType: PaymentFeeRuleType.RATE,
              rateBps: 100,
              fixedAmount: 1000,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
          ],
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.paymentFeePolicyPreflight('policy-blocked')).resolves.toMatchObject({
      sampleAmount: 100000,
      readyForActivation: false,
      coverage: {
        configuredMethods: 0,
        duplicateMethods: [PaymentMethod.MOMO],
        invalidMethods: [PaymentMethod.CARD],
        missingMethods: [
          PaymentMethod.VNPAY,
          PaymentMethod.CASH,
          PaymentMethod.BANK_TRANSFER,
          PaymentMethod.CUSTOMER_WALLET,
          PaymentMethod.MANUAL,
        ],
      },
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_METHOD_RULE', method: PaymentMethod.MOMO }),
        expect.objectContaining({ code: 'INVALID_METHOD_RULE', method: PaymentMethod.CARD }),
        expect.objectContaining({ code: 'MISSING_METHOD_RULE', method: PaymentMethod.CASH }),
      ]),
    });
  });

  it('creates payment fee policies as audited drafts regardless of client intent', async () => {
    const created = {
      id: 'payment-fee-policy-draft',
      name: 'Vietnam gateway fees',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      rules: [],
    };
    const tx = {
      paymentFeePolicyVersion: { create: vi.fn().mockResolvedValue(created) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.createPaymentFeePolicy('maker-admin', {
        name: ' Vietnam gateway fees ',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }),
    ).resolves.toBe(created);
    expect(tx.paymentFeePolicyVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: 'maker-admin',
          name: 'Vietnam gateway fees',
          status: 'DRAFT',
        }),
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'payment_fee_policy.create_draft' }),
      }),
    );
  });

  it('activates a complete payment fee policy with a different finance approver and audit evidence', async () => {
    const rules = Object.values(PaymentMethod).map((method, index) => ({
      id: `rule-${method}`,
      active: true,
      method,
      feeType: PaymentFeeRuleType.RATE,
      rateBps: index === 0 ? 150 : 0,
      fixedAmount: 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
    const draft = {
      id: 'payment-fee-policy-draft',
      name: 'Vietnam gateway fees',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: 'Gateway contract GF-2026-01 reviewed against the signed pricing schedule.',
      createdById: 'maker-admin',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: null,
      rules,
    };
    const active = { ...draft, status: 'ACTIVE' };
    const maker = {
      id: 'maker-admin',
      email: 'maker@example.test',
      fullName: 'Policy Maker',
      roles: [Role.ADMIN],
    };
    const approver = {
      id: 'approver-admin',
      email: 'approver@example.test',
      fullName: 'Finance Approver',
      roles: [Role.ADMIN, Role.FINANCE_APPROVER],
    };
    let approvalRequest: Record<string, unknown> | null = null;
    const tx = {
      paymentFeePolicyVersion: {
        findUnique: vi.fn().mockResolvedValue(draft),
        findUniqueOrThrow: vi.fn().mockResolvedValue(active),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }),
      },
      adminAuditLog: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockImplementation(() => approvalRequest),
        create: vi.fn().mockImplementation(({ data }) => {
          if (data.action === 'payment_fee_policy.approval_requested') {
            approvalRequest = {
              id: 'approval-request-1',
              action: data.action,
              actorId: data.actorId,
              actor: maker,
              createdAt: new Date('2026-07-13T12:00:00.000Z'),
              metadata: data.metadata,
            };
            return approvalRequest;
          }
          return { id: 'audit-2' };
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(tx)),
      user: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(maker)
          .mockResolvedValueOnce(approver)
          .mockResolvedValueOnce(approver),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.requestPaymentFeePolicyApproval(
        'admin-token-user',
        draft.id,
        { reason: 'Request independent contract review' },
        maker.email,
      ),
    ).resolves.toMatchObject({ status: 'REQUESTED', requestedBy: expect.objectContaining({ id: maker.id }) });
    await expect(
      service.activatePaymentFeePolicy(
        'admin-token-user',
        draft.id,
        {
          approvalAdminId: approver.id,
          reason: 'Approved against gateway contract',
        },
        approver.email,
      ),
    ).resolves.toBe(active);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'approver-admin', roles: { has: Role.FINANCE_APPROVER } } }),
    );
    expect(tx.paymentFeePolicyVersion.updateMany).toHaveBeenCalledWith({
      where: { id: { not: draft.id }, status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'payment_fee_policy.activate',
          metadata: expect.objectContaining({ approvalAdminId: 'approver-admin', ruleCount: 7 }),
        }),
      }),
    );
  });

  it('persists rejection evidence and allows the maker to request the same corrected review again', async () => {
    const rules = Object.values(PaymentMethod).map((method) => ({
      active: true,
      method,
      feeType: PaymentFeeRuleType.RATE,
      rateBps: method === PaymentMethod.CARD ? 150 : 0,
      fixedAmount: 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
    }));
    const draft = {
      id: 'payment-fee-policy-rejected',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: 'Signed gateway pricing schedule',
      rules,
    };
    const maker = {
      id: 'maker-admin',
      email: 'maker@example.test',
      fullName: 'Policy Maker',
      roles: [Role.ADMIN],
    };
    const approver = {
      id: 'approver-admin',
      email: 'approver@example.test',
      fullName: 'Finance Approver',
      roles: [Role.ADMIN, Role.FINANCE_APPROVER],
    };
    let latestEvent: Record<string, unknown> | null = null;
    let eventSequence = 0;
    const tx = {
      paymentFeePolicyVersion: { findUnique: vi.fn().mockResolvedValue(draft) },
      adminAuditLog: {
        findFirst: vi.fn().mockImplementation(() => latestEvent),
        create: vi.fn().mockImplementation(({ data }) => {
          eventSequence += 1;
          latestEvent = {
            id: `approval-event-${eventSequence}`,
            action: data.action,
            actorId: data.actorId,
            actor: data.actorId === maker.id ? maker : approver,
            createdAt: new Date(`2026-07-13T12:0${eventSequence}:00.000Z`),
            metadata: data.metadata,
          };
          return latestEvent;
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(tx)),
      user: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(maker)
          .mockResolvedValueOnce(approver)
          .mockResolvedValueOnce(approver)
          .mockResolvedValueOnce(maker),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.requestPaymentFeePolicyApproval(
        'admin-token-user',
        draft.id,
        { reason: 'Review the signed fee schedule' },
        maker.email,
      ),
    ).resolves.toMatchObject({ status: 'REQUESTED' });
    await expect(
      service.rejectPaymentFeePolicyApproval(
        'admin-token-user',
        draft.id,
        { reason: 'CARD fee differs from the signed schedule' },
        approver.email,
      ),
    ).resolves.toMatchObject({
      status: 'REJECTED',
      requestedBy: expect.objectContaining({ id: maker.id }),
      decidedBy: expect.objectContaining({ id: approver.id }),
      reason: 'CARD fee differs from the signed schedule',
    });
    await expect(
      service.requestPaymentFeePolicyApproval(
        'admin-token-user',
        draft.id,
        { reason: 'Request review again after checking the schedule' },
        maker.email,
      ),
    ).resolves.toMatchObject({ status: 'REQUESTED' });
    expect(tx.adminAuditLog.create.mock.calls.map(([input]) => input.data.action)).toEqual([
      'payment_fee_policy.approval_requested',
      'payment_fee_policy.approval_rejected',
      'payment_fee_policy.approval_requested',
    ]);
  });

  it('allows only the requesting operator to cancel a pending payment fee policy review', async () => {
    const rules = Object.values(PaymentMethod).map((method) => ({
      active: true,
      method,
      feeType: PaymentFeeRuleType.RATE,
      rateBps: 0,
      fixedAmount: 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
    }));
    const draft = {
      id: 'payment-fee-policy-cancelled',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: 'Signed gateway pricing schedule',
      rules,
    };
    const maker = {
      id: 'maker-admin',
      email: 'maker@example.test',
      fullName: 'Policy Maker',
      roles: [Role.ADMIN],
    };
    const otherOperator = {
      id: 'other-admin',
      email: 'other@example.test',
      fullName: 'Other Operator',
      roles: [Role.ADMIN],
    };
    let latestEvent: Record<string, unknown> | null = null;
    let eventSequence = 0;
    const tx = {
      paymentFeePolicyVersion: { findUnique: vi.fn().mockResolvedValue(draft) },
      adminAuditLog: {
        findFirst: vi.fn().mockImplementation(() => latestEvent),
        create: vi.fn().mockImplementation(({ data }) => {
          eventSequence += 1;
          latestEvent = {
            id: `approval-cancel-event-${eventSequence}`,
            action: data.action,
            actorId: data.actorId,
            actor: maker,
            createdAt: new Date(`2026-07-13T12:0${eventSequence}:00.000Z`),
            metadata: data.metadata,
          };
          return latestEvent;
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(tx)),
      user: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(maker)
          .mockResolvedValueOnce(otherOperator)
          .mockResolvedValueOnce(maker),
      },
    };
    const service = createAdminService(prisma);
    await expect(
      service.requestPaymentFeePolicyApproval(
        'admin-token-user',
        draft.id,
        { reason: 'Review this policy revision' },
        maker.email,
      ),
    ).resolves.toMatchObject({ status: 'REQUESTED' });

    await expect(
      service.cancelPaymentFeePolicyApproval(
        'admin-token-user',
        draft.id,
        { reason: 'Attempt cancellation by another operator' },
        otherOperator.email,
      ),
    ).rejects.toThrow('Only the requesting operator can cancel');
    await expect(
      service.cancelPaymentFeePolicyApproval(
        'admin-token-user',
        draft.id,
        { reason: 'Withdraw until the contract reference is corrected' },
        maker.email,
      ),
    ).resolves.toMatchObject({
      status: 'CANCELLED',
      requestedBy: expect.objectContaining({ id: maker.id }),
      decidedBy: expect.objectContaining({ id: maker.id }),
    });
    expect(tx.adminAuditLog.create.mock.calls.map(([input]) => input.data.action)).toEqual([
      'payment_fee_policy.approval_requested',
      'payment_fee_policy.approval_cancelled',
    ]);
  });

  it('rejects signer mismatch and incomplete payment fee policy activation', async () => {
    const prisma = {
      $transaction: vi.fn(),
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }) },
    };
    const service = createAdminService(prisma);

    await expect(
      service.activatePaymentFeePolicy('maker-admin', 'policy-1', {
        approvalAdminId: 'maker-admin',
        reason: 'Self approval',
      }),
    ).rejects.toThrow('must be completed by the signed-in approver');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const incompleteDraft = {
      id: 'policy-1',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: 'Gateway contract evidence',
      rules: [],
    };
    const tx = {
      paymentFeePolicyVersion: { findUnique: vi.fn().mockResolvedValue(incompleteDraft) },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await expect(
      service.activatePaymentFeePolicy('maker-admin', 'policy-1', {
        approvalAdminId: 'finance-admin-2',
        reason: 'Missing rules',
      }),
    ).rejects.toThrow('requires exactly one active MOMO rule');
  });

  it('rejects payment fee policy activation without a persisted approval request', async () => {
    const rules = Object.values(PaymentMethod).map((method) => ({
      active: true,
      method,
      feeType: PaymentFeeRuleType.RATE,
      rateBps: 0,
      fixedAmount: 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
    }));
    const draft = {
      id: 'payment-fee-policy-no-request',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: 'Gateway contract evidence',
      rules,
    };
    const tx = {
      paymentFeePolicyVersion: {
        findUnique: vi.fn().mockResolvedValue(draft),
        updateMany: vi.fn(),
      },
      adminAuditLog: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(tx)),
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'approver-admin' }) },
    };
    const service = createAdminService(prisma);

    await expect(
      service.activatePaymentFeePolicy(
        'admin-token-user',
        draft.id,
        {
          approvalAdminId: 'approver-admin',
          reason: 'Approve without request',
        },
        'approver@example.test',
      ),
    ).rejects.toThrow('requires a pending approval request');
    expect(tx.paymentFeePolicyVersion.updateMany).not.toHaveBeenCalled();
  });

  it('rejects payment fee policy activation after the requested draft revision changes', async () => {
    const rules = Object.values(PaymentMethod).map((method) => ({
      active: true,
      method,
      feeType: PaymentFeeRuleType.RATE,
      rateBps: method === PaymentMethod.CARD ? 175 : 0,
      fixedAmount: 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
    }));
    const changedDraft = {
      id: 'payment-fee-policy-stale-request',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: 'Gateway contract evidence revised after the request',
      rules,
    };
    const tx = {
      paymentFeePolicyVersion: {
        findUnique: vi.fn().mockResolvedValue(changedDraft),
        updateMany: vi.fn(),
      },
      adminAuditLog: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'approval-request-stale',
          action: 'payment_fee_policy.approval_requested',
          actorId: 'maker-admin',
          actor: { id: 'maker-admin', email: 'maker@example.test', fullName: 'Policy Maker' },
          createdAt: new Date('2026-07-13T12:00:00.000Z'),
          metadata: {
            policyFingerprint: 'fingerprint-before-draft-change',
            reason: 'Review the original policy revision',
          },
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(tx)),
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'approver-admin' }) },
    };
    const service = createAdminService(prisma);

    await expect(
      service.activatePaymentFeePolicy(
        'admin-token-user',
        changedDraft.id,
        {
          approvalAdminId: 'approver-admin',
          reason: 'Approve the stale request',
        },
        'approver@example.test',
      ),
    ).rejects.toThrow('changed after approval was requested');
    expect(tx.paymentFeePolicyVersion.updateMany).not.toHaveBeenCalled();
  });

  it('blocks payment fee policy preflight and activation without contract evidence notes', async () => {
    const rules = Object.values(PaymentMethod).map((method) => ({
      active: true,
      method,
      feeType: PaymentFeeRuleType.RATE,
      rateBps: 0,
      fixedAmount: 0,
      payer: PaymentFeePayer.HANDS,
      treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
    }));
    const draft = {
      id: 'payment-fee-policy-without-evidence',
      status: 'DRAFT',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: null,
      rules,
    };
    const tx = {
      paymentFeePolicyVersion: { findUnique: vi.fn().mockResolvedValue(draft) },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(tx)),
      paymentFeePolicyVersion: { findUnique: vi.fn().mockResolvedValue(draft) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'approver-admin' }) },
    };
    const service = createAdminService(prisma);

    await expect(service.paymentFeePolicyPreflight(draft.id)).resolves.toMatchObject({
      readyForActivation: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'POLICY_EVIDENCE_REQUIRED' }),
      ]),
    });
    await expect(
      service.activatePaymentFeePolicy('maker-admin', draft.id, {
        approvalAdminId: 'approver-admin',
        reason: 'Approve complete rule coverage',
      }),
    ).rejects.toThrow('requires contract or pricing evidence notes');
    expect(tx.paymentFeePolicyVersion.findUnique).toHaveBeenCalled();
  });

  it('prevents rule changes after a payment fee policy leaves DRAFT', async () => {
    const tx = {
      paymentFeePolicyVersion: {
        findUnique: vi.fn().mockResolvedValue({ id: 'policy-1', status: 'ACTIVE' }),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = createAdminService(prisma);

    await expect(
      service.upsertPaymentFeeRule('maker-admin', 'policy-1', {
        method: PaymentMethod.CARD,
        feeType: PaymentFeeRuleType.RATE,
        rateBps: 150,
        fixedAmount: 0,
        payer: PaymentFeePayer.HANDS,
        treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
      }),
    ).rejects.toThrow('Only DRAFT payment fee policies can be changed');
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

    await expect(
      service.cashSettlementSummary({ q: 'booking-1', queue: 'payment-check', range: '7d' }),
    ).resolves.toEqual({
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
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const earnings = {
      listPayoutBatchesForAdmin: vi.fn().mockResolvedValue([{ id: 'payout-1' }]),
    };
    const service = createAdminService(prisma, { earnings });

    const result = await service.listPayoutBatches({
      range: '30d',
      review: 'needs-review',
      skip: '150',
      take: '75',
    });

    expect(result).toEqual([
      expect.objectContaining({
        approvalAdminId: null,
        createdByAdminId: null,
        id: 'payout-1',
        lastUpdatedByAdminId: null,
        paidByAdminId: null,
      }),
    ]);

    expect(earnings.listPayoutBatchesForAdmin).toHaveBeenCalledWith({
      range: '30d',
      review: 'needs-review',
      skip: '150',
      take: '75',
    });
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: { in: ['payout_batch.create', 'payout_batch.update'] },
        target: { in: ['payout_batch:payout-1'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { action: true, actorId: true, metadata: true, target: true },
    });
  });

  it('hydrates payout batch maker, paid executor, and separate approver identities from audit logs', async () => {
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            action: 'payout_batch.update',
            actorId: 'finance-maker-1',
            metadata: { approvalAdminId: 'finance-approver-2', status: PayoutBatchStatus.PAID },
            target: 'payout_batch:payout-1',
          },
          {
            action: 'payout_batch.create',
            actorId: 'finance-creator-1',
            metadata: {},
            target: 'payout_batch:payout-1',
          },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { email: 'creator@hands.vn', fullName: 'Finance Creator', id: 'finance-creator-1' },
          { email: 'maker@hands.vn', fullName: 'Finance Maker', id: 'finance-maker-1' },
          { email: 'approver@hands.vn', fullName: 'Finance Approver', id: 'finance-approver-2' },
        ]),
      },
    };
    const earnings = {
      listPayoutBatchesForAdmin: vi.fn().mockResolvedValue([
        { id: 'payout-1', status: PayoutBatchStatus.PAID },
      ]),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(service.listPayoutBatches({ take: '20' })).resolves.toEqual([
      expect.objectContaining({
        approvalAdmin: expect.objectContaining({ fullName: 'Finance Approver' }),
        approvalAdminId: 'finance-approver-2',
        createdBy: expect.objectContaining({ fullName: 'Finance Creator' }),
        createdByAdminId: 'finance-creator-1',
        lastUpdatedBy: expect.objectContaining({ fullName: 'Finance Maker' }),
        lastUpdatedByAdminId: 'finance-maker-1',
        paidBy: expect.objectContaining({ fullName: 'Finance Maker' }),
        paidByAdminId: 'finance-maker-1',
      }),
    ]);

    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: expect.arrayContaining([
            'finance-approver-2',
            'finance-creator-1',
            'finance-maker-1',
          ]),
        },
      },
      select: { id: true, email: true, fullName: true },
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

  it('marks an unlinked legacy system notification reviewed with atomic audit evidence', async () => {
    const tx = {
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-legacy-review' }) },
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          data: { destination: '/background-jobs', jobId: 'job-1', queueName: 'queue-1' },
          id: 'notification-legacy',
          type: 'admin.system.background_job.failed',
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            data: { destination: '/background-jobs', jobId: 'job-1', queueName: 'queue-1', recipient: 'admin-1' },
            id: 'notification-legacy',
            type: 'admin.system.background_job.failed',
          },
          {
            data: { destination: '/background-jobs', jobId: 'job-1', queueName: 'queue-1', recipient: 'admin-2' },
            id: 'notification-legacy-sibling',
            type: 'admin.system.background_job.failed',
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.reviewLegacyNotification(
        'admin-1',
        'notification-legacy',
        '  Reviewed   retained queue evidence and confirmed no linked incident.  ',
      ),
    ).resolves.toMatchObject({
      incidentStatus: 'LEGACY_REVIEWED',
      notificationId: 'notification-legacy',
      ok: true,
      reviewedNotificationCount: 2,
      reviewedAt: expect.any(String),
    });

    expect(tx.notification.findMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { data: true, id: true, type: true },
      where: {
        AND: [
          { type: 'admin.system.background_job.failed' },
          { data: { equals: 'queue-1', path: ['queueName'] } },
          { data: { equals: 'job-1', path: ['jobId'] } },
          { data: { equals: Prisma.AnyNull, path: ['incidentId'] } },
          { data: { equals: Prisma.AnyNull, path: ['incidentStatus'] } },
        ],
      },
    });
    expect(tx.notification.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.notification.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: {
          data: expect.objectContaining({
            incidentStatus: 'LEGACY_REVIEWED',
            legacyReviewReason: 'Reviewed retained queue evidence and confirmed no linked incident.',
            legacyReviewedAt: expect.any(String),
            legacyReviewedByAdminId: 'admin-1',
            recipient: 'admin-1',
          }),
        },
        where: {
          data: { equals: Prisma.AnyNull, path: ['incidentStatus'] },
          id: 'notification-legacy',
          type: 'admin.system.background_job.failed',
        },
      }),
    );
    expect(tx.notification.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: { data: expect.objectContaining({ recipient: 'admin-2' }) },
        where: expect.objectContaining({ id: 'notification-legacy-sibling' }),
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'notification.legacy_reviewed',
        actorId: 'admin-1',
        metadata: expect.objectContaining({
          incidentStatus: 'LEGACY_REVIEWED',
          notificationId: 'notification-legacy',
          reason: 'Reviewed retained queue evidence and confirmed no linked incident.',
          reviewedNotificationCount: 2,
          source: 'admin_notification_legacy_review',
          sourceKey: 'job:queue-1:job-1',
        }),
        target: 'notification:notification-legacy',
      },
    });
  });

  it('rejects legacy review for linked incidents and inadequate evidence', async () => {
    const linkedTx = {
      adminAuditLog: { create: vi.fn() },
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          data: { incidentId: 'incident-1' },
          id: 'notification-linked',
          type: 'admin.system.background_job.failed',
        }),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof linkedTx) => Promise<unknown>) => callback(linkedTx)),
    };
    const service = createAdminService(prisma);

    await expect(
      service.reviewLegacyNotification('admin-1', 'notification-linked', 'Reviewed source evidence.'),
    ).rejects.toThrow('Linked incidents must be resolved from Background Jobs');
    await expect(
      service.reviewLegacyNotification('admin-1', 'notification-linked', 'too short'),
    ).rejects.toThrow('must be at least 12 characters');
    expect(linkedTx.notification.updateMany).not.toHaveBeenCalled();
    expect(linkedTx.adminAuditLog.create).not.toHaveBeenCalled();
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

  it('filters notification board rows by user id without loading unrelated notifications', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications({
      review: 'all',
      take: '20',
      user: 'user-1',
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        where: {
          AND: [{ userId: 'user-1' }],
        },
      }),
    );
  });

  it('filters Finance overdue notifications at the database boundary', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{
        id: 'notification-finance-open',
        ownerAdminId: 'admin-owner-1',
        ownerEmail: 'owner@hands.test',
        ownerFullName: 'Finance Owner',
        reviewAgeHours: 76,
        reviewStartedAt: new Date('2026-07-10T00:00:00.000Z'),
      }]),
      notification: {
        findMany: vi.fn().mockResolvedValue([{
          data: { bankTransactionId: 'bank-1' },
          id: 'notification-finance-open',
          type: 'admin.finance.bank_transaction.review_escalated',
        }]),
      },
    };
    const service = createAdminService(prisma);

    const result = await service.listNotifications({
      financeAge: '72-plus',
      financeOwner: 'admin-owner-1',
      review: 'finance-overdue',
      take: '20',
    });

    const pageQuery = prisma.$queryRaw.mock.calls[0]?.[0] as { sql: string; values: unknown[] };
    expect(pageQuery.sql).toContain('assignment."createdAt"');
    expect(pageQuery.sql).toContain('batch_import."createdAt"');
    expect(pageQuery.sql).toContain('finance_reviews."reviewStartedAt" ASC');
    expect(pageQuery.sql).toContain('review_rows."reviewAgeHours" >= 72');
    expect(pageQuery.sql).toContain('review_rows."ownerAdminId" =');
    expect(pageQuery.sql).toContain('LIMIT');
    expect(pageQuery.values).toContain(20);
    expect(pageQuery.values).toContain(0);
    expect(pageQuery.values).toContain('admin-owner-1');

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        where: { id: { in: ['notification-finance-open'] } },
      }),
    );
    expect(result[0]).toMatchObject({
      data: {
        bankTransactionId: 'bank-1',
        financeReviewAgeHours: 76,
        financeReviewOwner: {
          email: 'owner@hands.test',
          fullName: 'Finance Owner',
          id: 'admin-owner-1',
        },
        financeReviewSlaBand: 'OVER_72H',
        financeReviewStartedAt: '2026-07-10T00:00:00.000Z',
      },
    });
  });

  it('filters resolved Finance overdue notifications into retained history', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications({ review: 'finance-overdue-history', take: '20' });

    const pageQuery = prisma.$queryRaw.mock.calls[0]?.[0] as { sql: string };
    expect(pageQuery.sql).toContain("financeReviewStatus' = 'RESOLVED'");
    expect(pageQuery.sql).toContain('finance_reviews."resolvedAt" DESC NULLS LAST');

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [] } },
      }),
    );
  });

  it('counts Finance overdue rows with the same SLA age and owner filters as the page query', async () => {
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([
          { count: 3, ownerAdminId: null },
          { count: 2, ownerAdminId: 'admin-owner-1' },
        ]),
      notification: { count: vi.fn().mockResolvedValue(0) },
      notificationDelivery: { count: vi.fn().mockResolvedValue(0) },
    };
    const service = createAdminService(prisma);

    const result = await service.notificationSummary({
      financeAge: '48-72',
      financeOwner: 'unassigned',
      review: 'finance-overdue',
    });

    expect(result.totalCount).toBe(2);
    expect(result.financeReviewOwnerSummary).toEqual([
      { count: 3, ownerAdminId: null },
      { count: 2, ownerAdminId: 'admin-owner-1' },
    ]);
    const countQuery = prisma.$queryRaw.mock.calls[0]?.[0] as { sql: string };
    expect(countQuery.sql).toContain('review_rows."reviewAgeHours" >= 48');
    expect(countQuery.sql).toContain('review_rows."reviewAgeHours" < 72');
    expect(countQuery.sql).toContain('review_rows."ownerAdminId" IS NULL');
    expect(countQuery.sql).toContain('COUNT(*)::integer AS count');
    expect(countQuery.sql).toContain('current_assignment."metadata"->>\'assigneeAdminId\'');
    expect(countQuery.sql).toContain('ORDER BY logs."createdAt" DESC, logs.id DESC');
    expect(countQuery.values).toContain('company_bank_transaction.review_assignment');
    const ownerSummaryQuery = prisma.$queryRaw.mock.calls[1]?.[0] as { sql: string };
    expect(ownerSummaryQuery.sql).toContain('GROUP BY finance_reviews."ownerAdminId"');
    expect(ownerSummaryQuery.sql).toContain('review_rows."reviewAgeHours" >= 48');
    expect(ownerSummaryQuery.sql).toContain('review_rows."reviewAgeHours" < 72');
    expect(ownerSummaryQuery.sql).not.toContain('review_rows."ownerAdminId" IS NULL');
  });

  it('rejects unsupported Finance overdue SLA filters before querying the database', async () => {
    const prisma = {
      $queryRaw: vi.fn(),
      notification: { findMany: vi.fn() },
    };
    const service = createAdminService(prisma);

    await expect(service.listNotifications({
      financeAge: 'older-than-forever',
      review: 'finance-overdue',
    })).rejects.toThrow('Notification Finance age filter is invalid');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('paginates Admin system incidents by source at the database boundary', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications({ review: 'system-incidents' });

    const sourceQuery = prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string; values?: unknown[] };
    expect(sourceQuery.sql).toContain('PARTITION BY filtered."sourceKey"');
    expect(sourceQuery.sql).toContain('COUNT(DISTINCT filtered."userId")');
    expect(sourceQuery.sql).toContain(`notification."type" LIKE 'admin.system.%'`);
    expect(sourceQuery.sql).toContain(`'incident:' || (notification."data"->>'incidentId')`);
    expect(sourceQuery.sql).toContain(`'job:' || (notification."data"->>'queueName')`);
    expect(sourceQuery.sql).toContain('LIMIT');
    expect(sourceQuery.values).toContain(20);
    expect(sourceQuery.values).toContain(0);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, where: { id: { in: [] } } }),
    );
  });

  it.each([
    ['open', 'OPEN'],
    ['recovered', 'RECOVERED'],
    ['reviewed', 'LEGACY_REVIEWED'],
  ] as const)(
    'filters %s incident sources with the resolved server-side state',
    async (incidentState, persistedState) => {
      const prisma = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        notification: { findMany: vi.fn().mockResolvedValue([]) },
      };
      const service = createAdminService(prisma);

      await service.listNotifications({ incidentState, review: 'system-incidents' });

      const stateRank = persistedState === 'OPEN' ? 1 : persistedState === 'RECOVERED' ? 3 : 4;
      const sourceQuery = prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string; values?: unknown[] };
      expect(sourceQuery.sql).toContain('grouped."resolvedStateRank"');
      expect(sourceQuery.values).toContain(stateRank);
    },
  );

  it('keeps legacy system alerts in an explicit server-side review queue', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      notification: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = createAdminService(prisma);

    await service.listNotifications({ incidentState: 'legacy', review: 'system-incidents' });

    const sourceQuery = prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string; values?: unknown[] };
    expect(sourceQuery.sql).toContain('grouped."resolvedStateRank"');
    expect(sourceQuery.values).toContain(2);
  });

  it('enriches bounded background-job notifications with open and recovered incident states', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'notification-open',
          notificationCount: 2,
          recipientCount: 2,
          sourceKey: 'incident:incident-open',
        },
        {
          id: 'notification-recovered',
          notificationCount: 1,
          recipientCount: 1,
          sourceKey: 'incident:incident-recovered',
        },
      ]),
      adminAuditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-07-14T05:05:00.000Z'),
            metadata: {
              openedAuditId: 'incident-recovered',
              recoveredAt: '2026-07-14T05:04:00.000Z',
            },
          },
        ]),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([
          {
            data: { incidentId: 'incident-open', queueName: 'notification-retry' },
            id: 'notification-open',
            type: 'admin.system.background_job.failed',
          },
          {
            data: { incidentId: 'incident-recovered', queueName: 'bank-statement-escalation' },
            id: 'notification-recovered',
            type: 'admin.system.background_job.failed',
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listNotifications({ review: 'system-incidents' })).resolves.toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 'incident-open',
          incidentRecoveredAt: null,
          incidentStatus: 'OPEN',
          systemIncidentNotificationCount: 2,
          systemIncidentRecipientCount: 2,
          systemIncidentSourceKey: 'incident:incident-open',
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 'incident-recovered',
          incidentRecoveredAt: '2026-07-14T05:04:00.000Z',
          incidentStatus: 'RECOVERED',
          systemIncidentNotificationCount: 1,
          systemIncidentRecipientCount: 1,
          systemIncidentSourceKey: 'incident:incident-recovered',
        }),
      }),
    ]);
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: 'admin.background_jobs.recurring_incident_recovered',
        OR: [
          { metadata: { path: ['openedAuditId'], equals: 'incident-open' } },
          { metadata: { path: ['openedAuditId'], equals: 'incident-recovered' } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 2,
      select: { createdAt: true, metadata: true },
    });
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
        count: vi
          .fn()
          .mockResolvedValueOnce(172)
          .mockResolvedValueOnce(64)
          .mockResolvedValueOnce(121)
          .mockResolvedValueOnce(7),
        groupBy: vi.fn(),
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
    expect(prisma.notificationDelivery.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              notification: expect.objectContaining({
                createdAt: {
                  gte: new Date('2026-06-27T00:00:00.000Z'),
                  lt: new Date('2026-06-28T00:00:00.000Z'),
                },
              }),
            }),
            { provider: 'FCM' },
          ]),
        }),
      }),
    );
    expect(prisma.notificationDelivery.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ provider: 'IN_APP_ONLY' }]),
        }),
      }),
    );
    expect(prisma.notificationDelivery.count).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ status: 'SENT' }]),
        }),
      }),
    );
    expect(prisma.notificationDelivery.count).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ status: 'SKIPPED' }]),
        }),
      }),
    );
    expect(prisma.notificationDelivery.count).toHaveBeenCalledTimes(4);
    expect(prisma.notificationDelivery.groupBy).not.toHaveBeenCalled();
  });

  it('counts system incident states independently from the selected incident queue', async () => {
    const notificationCount = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(7);
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          legacy: 2,
          notificationCount: 7,
          open: 1,
          recovered: 1,
          reviewed: 0,
          total: 4,
        },
      ]),
      notification: {
        count: notificationCount,
      },
      notificationDelivery: { count: vi.fn().mockResolvedValue(0) },
    };
    const service = createAdminService(prisma);

    await expect(
      service.notificationSummary({
        from: '2026-06-27T00:00:00.000Z',
        incidentState: 'open',
        review: 'system-incidents',
        to: '2026-06-28T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      legacySystemIncidentCount: 2,
      openSystemIncidentCount: 1,
      recoveredSystemIncidentCount: 1,
      systemIncidentCount: 4,
      systemIncidentNotificationCount: 7,
      systemIncidentSourceSummaryComplete: true,
      systemIncidentSourceTotalCount: 1,
      totalCount: 1,
    });

    expect(notificationCount).toHaveBeenCalledTimes(9);
    const summaryQuery = prisma.$queryRaw.mock.calls[0]?.[0] as { sql?: string; values?: unknown[] };
    expect(summaryQuery.sql).toContain('GROUP BY filtered."sourceKey"');
    expect(summaryQuery.sql).toContain('COUNT(*) FILTER');
    expect(summaryQuery.sql).toContain(`notification."type" LIKE 'admin.system.%'`);
    expect(summaryQuery.values).toEqual(expect.arrayContaining([
      new Date('2026-06-27T00:00:00.000Z'),
      new Date('2026-06-28T00:00:00.000Z'),
    ]));
  });

  it('rejects invalid notification board date windows', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(
      service.listNotifications({
        from: '2026-06-28T00:00:00.000Z',
        to: '2026-06-27T00:00:00.000Z',
      }),
    ).rejects.toThrow('Notification date range is invalid');
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('seeds editable notification templates before listing the bounded catalog', async () => {
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

    await expect(service.listNotificationTemplates({ skip: '10', take: '500' })).resolves.toEqual([
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
      skip: 10,
      take: 50,
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

    await expect(service.listReviews({ providerProfileId: 'provider-1', take: '50' })).resolves.toEqual([
      { id: 'review-1' },
    ]);
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

  it('builds Finance Overview summary from ledger balances and amount aggregates without write side effects', async () => {
    const prisma = {
      refund: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 40000 } })
          .mockResolvedValueOnce({ _sum: { amount: 60000 } }),
      },
      payment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 75000 } }),
      },
      adminAuditLog: {
        count: vi.fn().mockResolvedValue(5),
      },
      $queryRaw: vi.fn().mockImplementation((query: { strings: readonly string[] }) => {
        const queryText = query.strings.join('?');
        if (queryText.includes('customer_balances')) {
          return Promise.resolve([
            {
              customerWalletAccountCount: 2n,
              customerWalletLiabilityAmount: 130000n,
              partnerPositiveWalletAccountCount: 1n,
              partnerWalletLiabilityAmount: 200000n,
              partnerNegativeWalletAccountCount: 1n,
              negativePartnerWalletAmount: 70000n,
            },
          ]);
        }
        return Promise.resolve([{ openOverdueCount: 3n, openOver72Count: 1n }]);
      }),
    };
    const service = createAdminService(prisma);
    vi.spyOn(service, 'bookingSettlementSnapshotSummary').mockResolvedValue({
      count: 2,
      currency: 'VND',
      customerPaymentAmount: 1000000,
      partnerPayoutAmount: 760000,
      partnerWithholdingTotal: 30000,
      platformFeeGross: 240000,
      platformFeeNetRevenue: 220000,
      companyOutputVat: 20000,
      paymentProcessingFee: 10000,
      openTaxCount: 1,
      paidTaxCount: 1,
    });
    vi.spyOn(service, 'couponFinanceSummary').mockResolvedValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'partnerWithholdingTaxSummary').mockResolvedValue({
      period: '2026-07',
      currency: 'VND',
    } as never);
    vi.spyOn(service, 'providerWalletWithdrawalRequestSummary').mockResolvedValue({
      currency: 'VND',
    } as never);
    vi.spyOn(service, 'bookingPaymentClearingSummary').mockResolvedValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'bankReconciliationSummary').mockResolvedValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'bankReconciliationWithdrawalCandidateSummary').mockResolvedValue({
      assignedCount: 1,
      assignments: [],
      currency: 'VND',
      eligibleCount: 3,
      noneAmount: 100000,
      noneCount: 1,
      oldestReviewOccurredAt: '2026-07-14T03:00:00.000Z',
      oldestStrongOccurredAt: '2026-07-13T03:00:00.000Z',
      reviewAmount: 200000,
      reviewCount: 1,
      reviewOver24hCount: 1,
      reviewOver48hCount: 0,
      strongAmount: 300000,
      strongCount: 1,
      strongOver24hCount: 1,
      strongOver48hCount: 1,
      unassignedCount: 2,
    });
    vi.spyOn(service, 'monthlyTaxClosingSummary').mockResolvedValue({
      period: '2026-07',
      currency: 'VND',
    } as never);
    vi.spyOn(service, 'earningsSummary').mockReturnValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'paymentSummary').mockResolvedValue({ totalCount: 3 } as never);
    vi.spyOn(service, 'refundSummary').mockResolvedValue({ openCount: 1 } as never);
    vi.spyOn(service, 'cashSettlementSummary').mockReturnValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'paymentFeeSummary').mockResolvedValue({ period: '2026-07', currency: 'VND' } as never);

    const result = await (
      service as unknown as {
        financeOverviewSummary(options: { range?: string; period?: string }): Promise<{
          amountSummary: {
            paymentFailedAmount: number;
            refundCompletedAmount: number;
            refundPendingAmount: number;
          };
          financeReviewSlaSummary: {
            open48To72Count: number;
            openOverdueCount: number;
            openOver72Count: number;
            resolvedInRangeCount: number;
          };
          settlementSummary: { platformFeeNetRevenue: number };
          bankWithdrawalCandidateSummary: { strongCount: number };
          walletSummary: {
            customerWalletAccountCount: number;
            customerWalletLiabilityAmount: number;
            negativePartnerWalletAmount: number;
            partnerNegativeWalletAccountCount: number;
            partnerPositiveWalletAccountCount: number;
            partnerWalletLiabilityAmount: number;
          };
        }>;
      }
    ).financeOverviewSummary({ range: '7d', period: '2026-07' });

    expect(result.walletSummary).toMatchObject({
      customerWalletAccountCount: 2,
      customerWalletLiabilityAmount: 130000,
      negativePartnerWalletAmount: 70000,
      partnerNegativeWalletAccountCount: 1,
      partnerPositiveWalletAccountCount: 1,
      partnerWalletLiabilityAmount: 200000,
    });
    expect(result.amountSummary).toEqual({
      currency: 'VND',
      paymentFailedAmount: 75000,
      refundCompletedAmount: 60000,
      refundPendingAmount: 40000,
    });
    expect(result.financeReviewSlaSummary).toEqual({
      open48To72Count: 2,
      openOverdueCount: 3,
      openOver72Count: 1,
      resolvedInRangeCount: 5,
    });
    expect(result.settlementSummary.platformFeeNetRevenue).toBe(220000);
    expect(result.bankWithdrawalCandidateSummary.strongCount).toBe(1);
    const walletQuery = prisma.$queryRaw.mock.calls
      .map(([query]) => query as { strings: readonly string[]; values: readonly unknown[] })
      .find((query) => query.strings.join('?').includes('customer_balances'));
    const walletQueryText = walletQuery?.strings.join('?') ?? '';
    expect(walletQueryText).toContain('GROUP BY ledger."customerProfileId", ledger."currency"');
    expect(walletQueryText).toContain('GROUP BY ledger."providerProfileId", ledger."currency"');
    expect(walletQueryText).toContain('WHERE balance > 0');
    expect(walletQueryText).toContain('WHERE balance < 0');
    expect(prisma.refund.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { amount: true },
        where: expect.objectContaining({ status: PaymentStatus.FAILED }),
      }),
    );
    const financeReviewQuery = prisma.$queryRaw.mock.calls
      .map(([query]) => query as { strings: readonly string[]; values: readonly unknown[] })
      .find((query) => query.strings.join('?').includes('openOverdueCount'));
    const financeReviewQueryText = financeReviewQuery?.strings.join('?') ?? '';
    expect(financeReviewQueryText).toContain('assignment."createdAt"');
    expect(financeReviewQueryText).toContain('batch_import."createdAt"');
    expect(financeReviewQueryText).toContain("notification.\"data\"->>'assignmentAuditLogId'");
    expect(financeReviewQuery?.values).toContain('company_bank_transaction.batch_import');
    expect(financeReviewQuery?.values.some((value) => value instanceof Date)).toBe(true);
    expect(prisma.adminAuditLog.count).toHaveBeenCalledWith({
      where: {
        action: 'company_bank_transaction.review_escalation_resolved',
        createdAt: {
          gte: expect.any(Date),
          lte: expect.any(Date),
        },
      },
    });
  });
});
