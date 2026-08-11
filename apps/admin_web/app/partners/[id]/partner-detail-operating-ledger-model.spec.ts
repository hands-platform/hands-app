import type { PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import {
  buildPartnerOperatingLedger,
  type PartnerOperatingLedgerRow,
} from './partner-detail-operating-ledger-model';

describe('partner detail operating ledger model', () => {
  it('builds admin operating ledger rows from partner, booking, payout, and app evidence', () => {
    const rows = buildPartnerOperatingLedger(
      buildProvider(),
      buildBookingArchive(),
      {
        blockers: ['Withdrawal address missing'],
        status: 'Payout blocked',
      },
      {
        primaryReason: 'Marketplace gate clear',
      },
      {
        readyCount: 2,
        rows: [{ id: 'service-row-1' }, { id: 'service-row-2' }, { id: 'service-row-3' }],
      },
    );

    expect(rowByArea(rows, 'Identity')).toMatchObject({
      evidence: 'Linh Partner / +84900000000 / Ho Chi Minh City',
      href: '/partners/partner-1?section=dossier&dossier=evidence',
      status: 'Profile linked',
    });
    expect(rowByArea(rows, 'KYC')).toMatchObject({
      evidence: 'KYC APPROVED / profile APPROVED',
      status: 'KYC approved',
    });
    expect(rowByArea(rows, 'Bookings')).toMatchObject({
      evidence: '1 active / 1 completed / Marketplace gate clear',
      status: '2 total',
    });
    expect(rowByArea(rows, 'Chat')).toMatchObject({
      evidence: '1 retained message(s). Admin keeps archive after mobile chat hides.',
      status: '1 room(s)',
    });
    expect(rowByArea(rows, 'Wallet')).toMatchObject({
      evidence: '50.000 VND unpaid company fee from cash booking flow.',
      status: 'Cash fee debt',
    });
    expect(rowByArea(rows, 'App devices')).toMatchObject({
      evidence: '1 session(s) / 2 device(s)',
      status: '1 push-ready',
    });
    expect(rowByArea(rows, 'Location')).toMatchObject({
      evidence: 'Latest Partner location saved for dispatch checks.',
    });
    expect(JSON.stringify(rowByArea(rows, 'Location'))).not.toMatch(
      /\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/,
    );
    expect(rows.map((row) => row.area)).not.toEqual(
      expect.arrayContaining(['Withdrawal details', 'Tax profile optional']),
    );
    expect(rows).toHaveLength(11);
  });

  it('marks missing identity and KYC evidence without duplicating finance-only rows', () => {
    const rows = buildPartnerOperatingLedger(
      {
        auditLogs: [],
        city: null,
        currentLocationUpdatedAt: null,
        devices: [],
        documents: [{ status: 'APPROVED', type: 'CCCD_FRONT' }],
        earnings: [],
        id: 'partner-empty',
        legalName: '',
        reports: [],
        sanctions: [],
        sessions: [],
        user: { phone: null, pushDevices: [] },
        verification: { files: [], status: 'DRAFT' },
        verificationLogs: [],
      },
      [],
      {
        blockers: [],
        hold: { reason: 'Manual payout check' },
        status: 'Deferred',
      },
      {
        primaryReason: 'No service pricing',
      },
      {
        readyCount: 0,
        rows: [],
      },
    );

    expect(rowByArea(rows, 'Identity')).toMatchObject({
      evidence: ' / No phone / No city',
      status: 'Profile incomplete',
    });
    expect(rowByArea(rows, 'KYC')).toMatchObject({
      evidence: 'Missing: CCCD back side, Selfie verification',
      status: 'KYC review needed',
    });
    expect(rows.map((row) => row.area)).not.toEqual(
      expect.arrayContaining(['Withdrawal details', 'Tax profile optional']),
    );
  });
});

function rowByArea(rows: readonly PartnerOperatingLedgerRow[], area: string) {
  const row = rows.find((item) => item.area === area);
  if (!row) {
    throw new Error(`Missing operating ledger row: ${area}`);
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
    auditLogs: [{ id: 'audit-1' }],
    city: 'Ho Chi Minh City',
    currentLat: 10.78,
    currentLng: 106.7,
    currentLocationUpdatedAt: '2026-06-10T07:00:00.000Z',
    devices: [{ id: 'device-1' }, { id: 'device-2' }],
    documents: [
      { status: 'APPROVED', type: 'CCCD_FRONT' },
      { status: 'APPROVED', type: 'CCCD_BACK' },
      { status: 'APPROVED', type: 'SELFIE' },
    ],
    earnings: [
      {
        booking: { payment: { method: 'CASH' } },
        id: 'earning-debt',
        netAmount: -50000,
        status: 'AVAILABLE',
      },
      {
        booking: { payment: { method: 'CARD' } },
        id: 'earning-paid',
        netAmount: 120000,
        status: 'PAID',
      },
    ],
    id: 'partner-1',
    kyc: { status: 'APPROVED' },
    legalName: 'Linh Partner',
    reports: [{ id: 'report-1' }],
    sanctions: [],
    sessions: [{ id: 'session-1' }],
    taxProfile: {
      legalName: 'Linh Partner',
      status: 'APPROVED',
      taxCodeLast4: '4321',
    },
    user: {
      phone: '+84900000000',
      pushDevices: [{ enabled: true }, { enabled: false }],
    },
    verification: { files: [{ id: 'file-1' }], status: 'APPROVED' },
    verificationLogs: [{ id: 'verification-log-1' }],
  };
}
