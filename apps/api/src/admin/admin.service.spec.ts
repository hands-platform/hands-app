import {
  AccountingJournalBatchStatus,
  AccountingJournalSourceType,
  AdminOperatorPermissionCategory,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  BankReconciliationStatus,
  BookingMatchSource,
  BookingPaymentClearingStatus,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  CompanyBankAccountStatus,
  EarningStatus,
  MonthlyTaxClosingStatus,
  ParticipantStatus,
  PayoutBatchStatus,
  PaymentStatus,
  CompanyBankTransactionType,
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
        aggregate: vi.fn().mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
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
        findMany: vi.fn().mockResolvedValue([
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
        aggregate: vi.fn().mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
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
        aggregate: vi.fn().mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
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
        aggregate: vi.fn().mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
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
    expect(overview.selectionFriction.rows.map((row) => row.partnerId)).toEqual(['provider-viewed-not-booked']);
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
        aggregate: vi.fn().mockResolvedValue({ _sum: { grossAmount: null, netAmount: null, platformFee: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      providerBookingRequestEvent: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([{ providerProfileId: 'provider-list-viewer' }])
          .mockResolvedValueOnce([{ providerProfileId: 'provider-detail-viewer' }]),
        findMany: vi.fn().mockResolvedValue([
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

    await expect(service.listAdminCalendarEvents({ take: '500' })).resolves.toEqual([
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
        orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
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
            categories: [
              AdminOperatorPermissionCategory.BOOKINGS,
              AdminOperatorPermissionCategory.CUSTOMERS,
            ],
            updatedAt: new Date('2026-07-01T01:00:00.000Z'),
          },
        }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getAdminOperatorAccess('admin-token-user', 'operator@hands.vn')).resolves.toEqual({
      categories: [
        AdminOperatorPermissionCategory.BOOKINGS,
        AdminOperatorPermissionCategory.CUSTOMERS,
      ],
      email: 'operator@hands.vn',
      fullName: 'Operator One',
      id: 'operator-1',
      phone: '+84900000001',
      roles: [Role.ADMIN],
      updatedAt: '2026-07-01T01:00:00.000Z',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
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

    await expect(service.getAdminOperatorAccess('admin-token-user', 'master@hands.vn')).resolves.toMatchObject({
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
            in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.EXPIRED, BookingStatus.REFUNDED],
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
    expect((prisma.$queryRaw.mock.calls[5]?.[0] as { sql?: string })?.sql).toContain('COUNT(DISTINCT "customerProfileId")');
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
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'finance-admin-2' }),
      },
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
        approvalAdminId: 'finance-admin-2',
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
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'finance-admin-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'provider_wallet.bank_deposit_received',
        target: 'provider_wallet_ledger:wallet-deposit-1',
        metadata: expect.objectContaining({
          approvalAdminId: 'finance-admin-2',
        }),
      }),
    });
  });

  it('rejects partner bank deposits without separate approval before writing wallet ledger', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn(),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const earnings = {
      recordPartnerBankDeposit: vi.fn(),
    };
    const service = createAdminService(prisma, { earnings });
    const input = {
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: '2026-06-29T09:30:00.000Z',
      attachmentFileId: 'file-deposit-proof-1',
    };

    await expect(service.recordPartnerBankDeposit('admin-user-1', input)).rejects.toThrow(
      'Partner bank deposit requires approval from a different admin',
    );
    await expect(
      service.recordPartnerBankDeposit('admin-user-1', {
        ...input,
        approvalAdminId: 'admin-user-1',
      } as never),
    ).rejects.toThrow('Partner bank deposit requires approval from a different admin');

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(earnings.recordPartnerBankDeposit).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects partner bank deposits approved by an admin without finance approver authority', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      adminAuditLog: {
        create: vi.fn(),
      },
    };
    const earnings = {
      recordPartnerBankDeposit: vi.fn(),
    };
    const service = createAdminService(prisma, { earnings });

    await expect(
      service.recordPartnerBankDeposit('admin-user-1', {
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
        approvalAdminId: 'support-user-2',
      } as never),
    ).rejects.toThrow('Partner bank deposit requires approval from a finance approver');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(earnings.recordPartnerBankDeposit).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
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
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'journal-batch-1' }),
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
        approvalAdminId: 'finance-admin-2',
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
    const journalUpdateEntries = vi.mocked(tx.accountingJournalBatch.upsert).mock.calls[0]?.[0]
      .update.entries;
    expect(Object.keys(journalUpdateEntries)).toEqual(['deleteMany', 'create']);
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-user-1',
        action: 'wallet_ledger.manual_adjustment.create',
        target: 'provider_wallet_ledger:ledger-1',
      }),
    });
  });

  it('creates customer manual promotion credits as wallet ledger plus journal without creating revenue', async () => {
    const tx = {
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
        ownerType: 'CUSTOMER',
        ownerId: 'customer-1',
        direction: 'CREDIT',
        adjustmentType: 'PROMOTION_CREDIT',
        amount: 100000,
        reason: 'Launch coupon correction',
        approvalId: 'approval-customer-1',
        approvalAdminId: 'finance-admin-2',
      }),
    ).resolves.toMatchObject({
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
        actorId: 'admin-user-1',
        action: 'wallet_ledger.manual_adjustment.create',
        target: 'customer_wallet_ledger:customer-ledger-1',
      }),
    });
  });

  it('rejects manual wallet adjustments approved by the same admin before writing a ledger', async () => {
    const tx = {
      providerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
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
      service.createManualWalletAdjustment('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        reason: 'Same admin cannot self-approve',
        approvalId: 'approval-1',
        approvalAdminId: 'admin-user-1',
      }),
    ).rejects.toThrow('Manual wallet adjustment requires approval from a different admin');

    expect(tx.providerProfile.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('rejects manual wallet adjustments approved by an admin without finance approver authority before writing a ledger', async () => {
    const tx = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
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
      service.createManualWalletAdjustment('admin-user-1', {
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        reason: 'Approver must be finance admin',
        approvalId: 'approval-1',
        approvalAdminId: 'support-user-2',
      }),
    ).rejects.toThrow('Manual wallet adjustment requires approval from a finance approver');

    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'support-user-2', roles: { has: Role.FINANCE_APPROVER } },
      select: { id: true },
    });
    expect(tx.providerProfile.findUniqueOrThrow).not.toHaveBeenCalled();
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

    await expect(service.listManualWalletAdjustments({ skip: '25', take: '25' })).resolves.toEqual([
      expect.objectContaining({
        id: 'provider-ledger-1',
        ownerLabel: 'Smoke Partner',
        ownerType: 'PARTNER',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
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
        approvalAdminId: 'finance-admin-2',
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
        approvalAdminId: 'finance-admin-2',
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
        approvalAdminId: 'finance-admin-2',
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

  it('loads one booking settlement snapshot with the finance audit select', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getBookingSettlementSnapshot('settlement-1')).resolves.toEqual({ id: 'settlement-1' });

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
        findMany: vi.fn().mockResolvedValue([{ id: 'bank-account-1', status: CompanyBankAccountStatus.ACTIVE }]),
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
          importedByAdminId: 'admin-user-1',
          manualImport: true,
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
        }),
        target: 'company_bank_transaction:bank-tx-1',
      }),
    });
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

    await expect(
      service.createBankReconciliationMatch('admin-user-1', 'bank-tx-1', input),
    ).rejects.toThrow('Bank reconciliation match requires approval from a different admin');
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
    ).rejects.toThrow('Partner withholding remittance paid closeout requires approval from a finance approver');

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
        count: vi.fn()
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
      customerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([
          { customerProfileId: 'customer-1', currency: 'VND', _sum: { amount: 100000 } },
          { customerProfileId: 'customer-2', currency: 'VND', _sum: { amount: 30000 } },
          { customerProfileId: 'customer-3', currency: 'VND', _sum: { amount: -5000 } },
        ]),
      },
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([
          { providerProfileId: 'provider-1', currency: 'VND', _sum: { amount: 200000 } },
          { providerProfileId: 'provider-2', currency: 'VND', _sum: { amount: -70000 } },
          { providerProfileId: 'provider-3', currency: 'VND', _sum: { amount: 0 } },
        ]),
      },
      refund: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 40000 } })
          .mockResolvedValueOnce({ _sum: { amount: 60000 } }),
      },
      payment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 75000 } }),
      },
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
    vi.spyOn(service, 'partnerWithholdingTaxSummary').mockResolvedValue({ period: '2026-07', currency: 'VND' } as never);
    vi.spyOn(service, 'providerWalletWithdrawalRequestSummary').mockResolvedValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'bookingPaymentClearingSummary').mockResolvedValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'bankReconciliationSummary').mockResolvedValue({ currency: 'VND' } as never);
    vi.spyOn(service, 'monthlyTaxClosingSummary').mockResolvedValue({ period: '2026-07', currency: 'VND' } as never);
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
          settlementSummary: { platformFeeNetRevenue: number };
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
    expect(result.settlementSummary.platformFeeNetRevenue).toBe(220000);
    expect(prisma.customerWalletLedgerEntry.groupBy).toHaveBeenCalledWith({
      by: ['customerProfileId', 'currency'],
      _sum: { amount: true },
    });
    expect(prisma.providerWalletLedgerEntry.groupBy).toHaveBeenCalledWith({
      by: ['providerProfileId', 'currency'],
      _sum: { amount: true },
    });
    expect(prisma.refund.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { amount: true },
        where: expect.objectContaining({ status: PaymentStatus.FAILED }),
      }),
    );
  });
});
