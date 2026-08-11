import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import type { ProviderFilters } from './partner-filters';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import {
  filterPartners,
  partnerNeedsApprovalReview,
  partnerMatchesBookingFlow,
  partnerMatchesReviewQueue,
  partnerReadiness,
  partnerSearchText,
  sortPartners,
} from './partner-list-query';

const now = new Date();

const emptyFilters: ProviderFilters = {
  age: 'all',
  activity: '',
  approvalMissing: '',
  approvalRisk: '',
  page: 1,
  pageSize: 10,
  q: '',
  verification: '',
  providerStatus: '',
  kyc: '',
  location: '',
  security: '',
  readiness: '',
  bookingFlow: '',
  review: '',
  sort: 'ops-priority',
};

const deps = {
  canAcceptBookingNow: (item: AdminProvider) => ['direct-ready', 'dispatch-ready'].includes(item.id),
  dispatchReady: (item: AdminProvider) => item.id === 'dispatch-ready',
  displayName: (item: AdminProvider) => item.displayName ?? item.user?.fullName ?? item.id,
  hasHardAcceptanceBlocker: (item: AdminProvider) => item.id === 'hard-blocked',
  marketplaceEligibility: (item: AdminProvider) => ({ eligible: item.id === 'marketplace-ready' }),
};

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: now.toISOString(),
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    user: {
      id: 'user-1',
      phone: '+84900000000',
      pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }],
    },
    ...input,
  } as AdminProvider;
}

function approvedPartner(input: Partial<AdminProvider> = {}): AdminProvider {
  return partner({
    bankAccounts: [
      {
        id: 'bank-1',
        bankName: 'VCB',
        accountHolderName: 'Linh Wellness',
        status: 'APPROVED',
        isPrimary: true,
      },
    ],
    documents: ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'].map((type) => ({
      id: `document-${type.toLowerCase()}`,
      type,
      status: 'APPROVED',
    })),
    ...input,
  });
}

function booking(input: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-001',
    status: 'MATCHED',
    chatRoom: null,
    updatedAt: now.toISOString(),
    createdAt: now.toISOString(),
    ...input,
  } as AdminBooking;
}

describe('partner list query', () => {
  it('builds searchable text from profile, services, media, device, report, and audit facts', () => {
    const text = partnerSearchText(
      partner({
        legalName: 'Nguyen Thi Linh',
        city: 'Ho Chi Minh City',
        user: {
          id: 'user-1',
          fullName: 'Linh Nguyen',
          phone: '+84911112222',
          fileAssets: [
            {
              id: 'file-1',
              purpose: 'PROVIDER_PUBLIC_IMAGE',
              key: 'partners/linh/profile.webp',
              contentType: 'image/webp',
              visibility: 'PUBLIC',
              reviewStatus: 'PENDING_REVIEW',
              reviewReason: 'needs crop',
            },
          ],
        },
        devices: [
          { id: 'device-1', deviceId: 'android-device-1', platform: 'android', enabled: true },
        ],
        reports: [
          {
            id: 'report-1',
            providerProfileId: 'partner-001',
            category: 'service',
            source: 'ADMIN',
            severity: 'LOW',
            status: 'OPEN',
            summary: 'late arrival',
            createdAt: now.toISOString(),
          },
        ],
        auditLogs: [
          {
            id: 'audit-1',
            action: 'partner.note.created',
            target: 'partner',
            metadata: { note: 'cash follow-up' },
            createdAt: now.toISOString(),
          },
        ],
        services: [{ id: 'provider-service-1', service: { id: 'service-1', name: 'Foot Massage' } }],
      }),
    );

    expect(text).toContain('linh wellness');
    expect(text).toContain('+84911112222');
    expect(text).toContain('foot massage');
    expect(text).toContain('late arrival');
    expect(text).toContain('cash follow-up');
    expect(text).toContain('android-device-1');
    expect(text).toContain('needs crop');
  });

  it('matches booking flow queues from preferred, participant, selected, chat, and completed work facts', () => {
    expect(partnerMatchesBookingFlow(partner({ selectedBookings: [booking()] }), 'active-booking')).toBe(true);
    expect(
      partnerMatchesBookingFlow(partner({ selectedBookings: [booking({ status: 'COMPLETED' })] }), 'active-booking'),
    ).toBe(false);
    expect(partnerMatchesBookingFlow(partner({ preferredBookings: [booking()] }), 'first-pick')).toBe(true);
    expect(
      partnerMatchesBookingFlow(
        partner({
          participants: [
            { id: 'participant-1', status: 'JOINED', booking: booking({ id: 'booking-market' }) },
          ],
        }),
        'marketplace-joined',
      ),
    ).toBe(true);
    expect(partnerMatchesBookingFlow(partner({ selectedBookings: [booking()] }), 'final-partner')).toBe(true);
    expect(
      partnerMatchesBookingFlow(
        partner({ selectedBookings: [booking({ chatRoom: { id: 'room-1' } })] }),
        'chat-live',
      ),
    ).toBe(true);
    expect(partnerMatchesBookingFlow(partner({ selectedBookings: [booking()] }), 'chat-missing')).toBe(true);
    expect(
      partnerMatchesBookingFlow(
        partner({
          earnings: [
            {
              id: 'earning-1',
              providerProfileId: 'partner-001',
              bookingId: 'booking-completed',
              grossAmount: 450000,
              platformFee: 70000,
              withholdingAmount: 0,
              netAmount: 380000,
              currency: 'VND',
              status: 'AVAILABLE',
              createdAt: now.toISOString(),
              booking: { status: 'COMPLETED' },
            },
          ],
        }),
        'completed-work',
      ),
    ).toBe(true);
  });

  it('uses injected eligibility callbacks for readiness and review queues', () => {
    expect(partnerReadiness(partner({ id: 'dispatch-ready' }), DEFAULT_PROVIDER_OPS_POLICY, deps)).toBe(
      'ready',
    );
    expect(partnerReadiness(partner({ id: 'hard-blocked', status: 'OFFLINE' }), DEFAULT_PROVIDER_OPS_POLICY, deps)).toBe(
      'needs-review',
    );
    expect(partnerReadiness(partner({ status: 'OFFLINE' }), DEFAULT_PROVIDER_OPS_POLICY, deps)).toBe(
      'approved-offline',
    );
    expect(
      partnerMatchesReviewQueue(partner({ id: 'direct-ready' }), 'direct-ready', DEFAULT_PROVIDER_OPS_POLICY, deps),
    ).toBe(true);
    expect(
      partnerMatchesReviewQueue(
        partner({ id: 'marketplace-ready' }),
        'marketplace-ready',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(true);
    expect(
      partnerMatchesReviewQueue(
        partner({ id: 'marketplace-blocked' }),
        'marketplace-blocked',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(true);
    expect(partnerNeedsApprovalReview(approvedPartner())).toBe(false);
    expect(
      partnerMatchesReviewQueue(
        approvedPartner({ verification: { id: 'verification-2', status: 'SUBMITTED' } }),
        'unapproved',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(true);
    expect(
      partnerMatchesReviewQueue(
        approvedPartner({
          id: 'wallet-debt',
          earnings: [
            {
              id: 'earning-debt',
              providerProfileId: 'wallet-debt',
              bookingId: 'booking-cash',
              grossAmount: 450000,
              platformFee: 120000,
              withholdingAmount: 0,
              netAmount: -120000,
              currency: 'VND',
              status: 'PENDING',
              createdAt: now.toISOString(),
            },
          ],
        }),
        'unsettled',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(true);
  });

  it('matches the approval-pending queue only for submitted verification or pending KYC', () => {
    expect(
      partnerMatchesReviewQueue(
        partner({ verification: { id: 'verification-submitted', status: 'SUBMITTED' } }),
        'approval-pending',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(true);
    expect(
      partnerMatchesReviewQueue(
        partner({ kyc: { id: 'kyc-pending', status: 'PENDING' } }),
        'approval-pending',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(true);
    expect(
      partnerMatchesReviewQueue(
        approvedPartner(),
        'approval-pending',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(false);
    expect(
      partnerMatchesReviewQueue(
        partner({
          verification: { id: 'verification-rejected', status: 'REJECTED' },
          kyc: { id: 'kyc-rejected', status: 'REJECTED' },
        }),
        'approval-pending',
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ),
    ).toBe(false);
  });

  it('matches booking flow queues from server booking summaries when relation rows are capped', () => {
    const cappedPartner = partner({
      preferredBookings: [],
      selectedBookings: [],
      participants: [],
      bookingSummary: {
        activeBookingCount: 5,
        adminClosedBookingCount: 0,
        bookingCount: 12,
        chatMissingCount: 1,
        chatRoomCount: 3,
        closedBookingCount: 2,
        completedBookingCount: 4,
        customerClosedBookingCount: 1,
        latestBookingAt: '2026-06-20T12:00:00.000Z',
        matchingBookingCount: 2,
        noShowBookingCount: 1,
        participatingBookingCount: 6,
        partnerClosedBookingCount: 1,
        preferredBookingCount: 2,
        selectedBookingCount: 3,
        workingBookingCount: 3,
      },
    });

    expect(partnerMatchesBookingFlow(cappedPartner, 'active-booking')).toBe(true);
    expect(partnerMatchesBookingFlow(cappedPartner, 'first-pick')).toBe(true);
    expect(partnerMatchesBookingFlow(cappedPartner, 'marketplace-joined')).toBe(true);
    expect(partnerMatchesBookingFlow(cappedPartner, 'final-partner')).toBe(true);
    expect(partnerMatchesBookingFlow(cappedPartner, 'chat-live')).toBe(true);
    expect(partnerMatchesBookingFlow(cappedPartner, 'chat-missing')).toBe(true);
    expect(partnerMatchesBookingFlow(cappedPartner, 'completed-work')).toBe(true);
    expect(partnerMatchesBookingFlow(cappedPartner, 'no-work')).toBe(false);
  });

  it('filters partners by combined search, status, location, security, readiness, and review facts', () => {
    const rows = [
      partner({ id: 'dispatch-ready', displayName: 'Linh Wellness' }),
      partner({ id: 'marketplace-ready', displayName: 'Mai Spa', status: 'OFFLINE' }),
      partner({
        id: 'blocked-device',
        displayName: 'An Spa',
        devices: [
          {
            id: 'device-1',
            deviceId: 'blocked-device-1',
            enabled: true,
            blockedAt: now.toISOString(),
          },
        ],
      }),
    ];

    expect(
      filterPartners(
        rows,
        {
          ...emptyFilters,
          q: 'linh',
          providerStatus: 'ONLINE_AVAILABLE',
          location: 'recent',
          security: 'missing',
          readiness: 'ready',
          review: 'direct-ready',
        },
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ).map((item: AdminProvider) => item.id),
    ).toEqual(['dispatch-ready']);

    expect(
      filterPartners(
        rows,
        { ...emptyFilters, security: 'blocked' },
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ).map((item: AdminProvider) => item.id),
    ).toEqual(['blocked-device']);
  });

  it('filters partner activity drilldowns by factual last activity age', () => {
    const rows = [
      partner({
        id: 'recent-activity',
        currentLocationUpdatedAt: now.toISOString(),
        sessions: [{ id: 'session-recent', lastSeenAt: now.toISOString(), suspicious: false }],
      }),
      partner({
        id: 'inactive-7d',
        currentLocationUpdatedAt: '2026-01-01T00:00:00.000Z',
        devices: [{ id: 'device-old', deviceId: 'old-device', enabled: true, lastSeenAt: '2026-01-02T00:00:00.000Z' }],
        sessions: [{ id: 'session-old', lastSeenAt: '2026-01-03T00:00:00.000Z', suspicious: false }],
      }),
      partner({
        id: 'never-online',
        currentLocationUpdatedAt: null,
        devices: [],
        sessions: [],
      }),
    ];

    expect(
      filterPartners(
        rows,
        { ...emptyFilters, activity: 'inactive-7d' },
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ).map((item: AdminProvider) => item.id),
    ).toEqual(['inactive-7d', 'never-online']);
    expect(
      filterPartners(
        rows,
        { ...emptyFilters, activity: 'never-online' },
        DEFAULT_PROVIDER_OPS_POLICY,
        deps,
      ).map((item: AdminProvider) => item.id),
    ).toEqual(['never-online']);
  });

  it('sorts wallet debt first and keeps checklist order stable by partner name', () => {
    const rows = [
      partner({ id: 'z-partner', displayName: 'Z Partner' }),
      partner({
        id: 'wallet-debt',
        displayName: 'Debt Partner',
        earnings: [
          {
            id: 'earning-debt',
            providerProfileId: 'wallet-debt',
            bookingId: 'booking-cash',
            grossAmount: 450000,
            platformFee: 120000,
            withholdingAmount: 0,
            netAmount: -120000,
            currency: 'VND',
            status: 'PENDING',
            createdAt: now.toISOString(),
          },
        ],
      }),
      partner({ id: 'a-partner', displayName: 'A Partner' }),
    ];

    expect(
      sortPartners(rows, DEFAULT_PROVIDER_OPS_POLICY, 'wallet-debt', deps).map(
        (item: AdminProvider) => item.id,
      ),
    ).toEqual([
      'wallet-debt',
      'a-partner',
      'z-partner',
    ]);

    expect(
      sortPartners(rows, DEFAULT_PROVIDER_OPS_POLICY, 'name', deps).map((item: AdminProvider) => item.id),
    ).toEqual([
      'a-partner',
      'wallet-debt',
      'z-partner',
    ]);
  });
});
