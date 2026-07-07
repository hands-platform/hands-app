import type { PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import {
  buildPartnerOperationsDigest,
  type PartnerOperationsDigestRow,
} from './partner-detail-operations-digest-model';

describe('partner detail operations digest model', () => {
  it('builds operations digest lanes from partner evidence', () => {
    const rows = buildPartnerOperationsDigest({
      activityRecords: [
        {
          at: '2026-06-10T08:00:00.000Z',
          detail: 'KYC approved by operations',
          id: 'activity-verify',
          title: 'KYC approved',
          type: 'VERIFY',
        },
      ],
      bookingAcceptance: {
        canJoinMarketplace: true,
        primaryReason: 'Marketplace gate clear',
      },
      bookingArchive: buildBookingArchive(),
      dispatchPolicy: {
        backupRadiusMeters: 10000,
        locationFreshnessMinutes: Number.POSITIVE_INFINITY,
      },
      provider: buildProvider(),
      providerServicePricing: {
        readyCount: 2,
      },
    });

    expect(rowByLane(rows, 'Identity')).toMatchObject({
      detail: 'Linh Partner / +84900000000 / Ho Chi Minh City',
      status: 'Profile linked',
      tone: 'pill-success',
    });
    expect(rowByLane(rows, 'Activity gate')).toMatchObject({
      detail: 'Marketplace gate clear',
      evidence: ['2 bookable option(s)', '50.000 VND cash fee debt', 'Account open'],
      status: 'Marketplace participation clear',
    });
    expect(rowByLane(rows, 'Bookings')).toMatchObject({
      evidence: ['1 active', '1 completed', 'booking-...'],
      status: '2 total',
      tone: 'pill-info',
    });
    expect(rowByLane(rows, 'Chat archive')).toMatchObject({
      detail: '1 retained message(s). Admin keeps chat history after mobile closeout.',
      status: '1 room(s)',
    });
    expect(rowByLane(rows, 'Staff trail')).toMatchObject({
      detail: 'KYC approved / KYC approved by operations',
      status: '1 audit row(s)',
      tone: 'pill-info',
    });
    expect(rowByLane(rows, 'Location')).toMatchObject({
      detail: 'Latest Partner location saved for dispatch checks. Policy freshness Infinitym.',
      evidence: ['1 record(s)', '10km marketplace radius', 'Fresh enough'],
      tone: 'pill-success',
    });
    expect(JSON.stringify(rowByLane(rows, 'Location'))).not.toMatch(
      /\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/,
    );
    expect(rows.map((row) => row.lane)).not.toEqual(
      expect.arrayContaining(['Finance', 'Withdrawal setup']),
    );
    expect(rows).toHaveLength(8);
  });

  it('builds hold-state digest lanes when partner evidence is missing', () => {
    const rows = buildPartnerOperationsDigest({
      activityRecords: [],
      bookingAcceptance: {
        canJoinMarketplace: false,
        primaryReason: 'No service pricing',
      },
      bookingArchive: [],
      dispatchPolicy: {
        backupRadiusMeters: 8000,
        locationFreshnessMinutes: 30,
      },
      provider: {
        auditLogs: [],
        city: null,
        currentLocationUpdatedAt: null,
        devices: [],
        documents: [],
        earnings: [],
        id: 'partner-empty',
        legalName: '',
        locationSnapshots: [],
        reports: [],
        sanctions: [],
        sessions: [],
        user: { phone: null, pushDevices: [] },
        verification: { files: [], status: 'DRAFT' },
        verificationLogs: [],
      },
      providerServicePricing: {
        readyCount: 0,
      },
    });

    expect(rowByLane(rows, 'Identity')).toMatchObject({
      detail: ' / No phone / No city',
      status: 'Profile incomplete',
      tone: 'pill-warn',
    });
    expect(rowByLane(rows, 'Activity gate')).toMatchObject({
      evidence: ['0 bookable option(s)', 'Cash fee clear', 'Account open'],
      status: 'Marketplace participation on hold',
      tone: 'pill-warn',
    });
    expect(rowByLane(rows, 'Bookings')).toMatchObject({
      detail: 'No preferred, selected, or marketplace participation booking is loaded.',
      status: '0 total',
      tone: 'pill-neutral',
    });
    expect(rows.map((row) => row.lane)).not.toEqual(
      expect.arrayContaining(['Finance', 'Withdrawal setup']),
    );
  });
});

function rowByLane(rows: readonly PartnerOperationsDigestRow[], lane: string) {
  const row = rows.find((item) => item.lane === lane);
  if (!row) {
    throw new Error(`Missing operations digest row: ${lane}`);
  }
  return row;
}

function buildBookingArchive(): PartnerBookingArchiveRecord[] {
  return [
    {
      booking: {
        chatRoom: {
          id: 'chat-1',
          messages: [{ body: 'On my way', createdAt: '2026-06-10T07:10:00.000Z' }],
        },
        createdAt: '2026-06-10T07:00:00.000Z',
        id: 'booking-active',
        services: [{ id: 'service-1', service: { name: 'Thai Massage' } }],
        status: 'MATCHED',
      },
      lastMessage: 'On my way',
      relation: 'Selected',
    },
    {
      booking: {
        createdAt: '2026-06-09T07:00:00.000Z',
        id: 'booking-completed',
        status: 'COMPLETED',
      },
      lastMessage: null,
      relation: 'Preferred',
    },
  ];
}

function buildProvider() {
  return {
    activityNickname: 'Linh',
    agreements: [{ id: 'agreement-1' }],
    auditLogs: [{ id: 'audit-1' }],
    city: 'Ho Chi Minh City',
    currentLat: 10.78,
    currentLng: 106.7,
    currentLocationUpdatedAt: '2026-06-10T07:00:00.000Z',
    dateOfBirth: '1991-06-01T00:00:00.000Z',
    devices: [{ id: 'device-1' }],
    documents: [
      { status: 'APPROVED', type: 'CCCD_FRONT' },
      { status: 'APPROVED', type: 'CCCD_BACK' },
      { status: 'APPROVED', type: 'SELFIE' },
    ],
    earnings: [
      {
        booking: { payment: { method: 'CASH' } },
        createdAt: '2026-06-10T07:30:00.000Z',
        id: 'earning-debt',
        netAmount: -50000,
        status: 'AVAILABLE',
      },
      {
        booking: { payment: { method: 'CARD' } },
        createdAt: '2026-06-09T07:30:00.000Z',
        id: 'earning-paid',
        netAmount: 120000,
        status: 'PAID',
      },
    ],
    gender: 'FEMALE',
    id: 'partner-1',
    kyc: {
      reviewedAt: '2026-06-10T05:00:00.000Z',
      status: 'APPROVED',
    },
    legalName: 'Linh Partner',
    locationSnapshots: [{ id: 'location-1', recordedAt: '2026-06-10T06:59:00.000Z' }],
    reports: [{ id: 'report-1' }],
    residentialAddress: 'District 1',
    sanctions: [],
    sessions: [{ id: 'session-1', lastSeenAt: '2026-06-10T08:30:00.000Z' }],
    taxProfile: {
      approvedAt: '2026-06-10T06:30:00.000Z',
      status: 'APPROVED',
    },
    user: {
      createdAt: '2026-06-01T00:00:00.000Z',
      phone: '+84900000000',
      pushDevices: [{ enabled: true }, { enabled: false }],
      updatedAt: '2026-06-10T08:00:00.000Z',
    },
    verification: { files: [{ id: 'file-1' }], status: 'APPROVED' },
    verificationLogs: [{ id: 'verification-log-1' }],
  };
}
