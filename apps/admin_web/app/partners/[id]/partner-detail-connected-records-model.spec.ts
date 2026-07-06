import type { PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import {
  buildPartnerConnectedRecordLinks,
  type PartnerDetailConnectedRecordLink,
} from './partner-detail-connected-records-model';

describe('partner detail connected records model', () => {
  it('builds connected record links from booking, compliance, payout, and note evidence', () => {
    const links = buildPartnerConnectedRecordLinks({
      bookingArchive: buildBookingArchive(),
      bookingGateAttempts: [
        {
          at: '2026-06-10T07:05:00.000Z',
          bookingMonitorHref: '/bookings?view=blocked-create&reason=wallet',
          reasonLabel: 'Cash fee debt',
        },
      ],
      canApproveKyc: true,
      kycEvidence: {
        missingDocuments: [],
      },
      payoutOps: {
        blockers: ['Withdrawal address missing'],
        status: 'Payout blocked',
        tone: 'blocked',
      },
      provider: buildProvider(),
    });

    expect(linkByLabel(links, 'Latest booking')).toMatchObject({
      detail: 'MATCHED / Thai Massage 60m',
      href: '/bookings/booking-active',
      tone: 'pill-info',
      value: 'booking-...',
    });
    expect(linkByLabel(links, 'First-pick gate attempts')).toMatchObject({
      detailDateTimePrefix: 'Cash fee debt / latest ',
      detailDateTimeValue: '2026-06-10T07:05:00.000Z',
      detail: 'Cash fee debt / latest 10 Jun 2026, 14:05',
      href: '/bookings?view=blocked-create&reason=wallet',
      tone: 'pill-warn',
      value: '1 attempt(s)',
    });
    expect(linkByLabel(links, 'Chat archive')).toMatchObject({
      detail: '1 retained room(s).',
      href: '/chat-archive?q=partner-1',
      tone: 'pill-success',
      value: '1 message(s)',
    });
    expect(linkByLabel(links, 'Wallet and payout')).toMatchObject({
      detail: 'Withdrawal address missing',
      tone: 'pill-danger',
      value: 'Payout blocked',
    });
    expect(linkByLabel(links, 'Location')).toMatchObject({
      detail: 'Latest Partner location saved for dispatch checks.',
      tone: 'pill-info',
      value: '10 Jun 2026, 14:00',
      valueDateTimeValue: '2026-06-10T07:00:00.000Z',
    });
    expect(JSON.stringify(linkByLabel(links, 'Location'))).not.toMatch(
      /\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/,
    );
    expect(linkByLabel(links, 'Operator notes')).toMatchObject({
      detail: 'Manual partner note',
      tone: 'pill-info',
      value: '1 note(s)',
    });
    expect(links.map((link) => link.label)).not.toEqual(
      expect.arrayContaining(['Withdrawal details', 'Tax profile optional']),
    );
    expect(links).toHaveLength(7);
  });

  it('builds fallback links when connected evidence is missing', () => {
    const links = buildPartnerConnectedRecordLinks({
      bookingArchive: [],
      bookingGateAttempts: [],
      canApproveKyc: false,
      kycEvidence: {
        missingDocuments: ['CCCD_FRONT', 'SELFIE'],
      },
      payoutOps: {
        blockers: [],
        hold: { reason: 'Manual payout review' },
        status: 'Deferred',
        tone: 'pending',
      },
      provider: {
        auditLogs: [],
        id: 'partner-empty',
        verification: { status: 'DRAFT' },
      },
    });

    expect(linkByLabel(links, 'Latest booking')).toMatchObject({
      detail: 'No preferred, selected, or marketplace participation booking loaded.',
      href: '#booking-chat-records',
      tone: 'pill-neutral',
      value: 'None',
    });
    expect(linkByLabel(links, 'First-pick gate attempts')).toMatchObject({
      detail: 'No booking create gate attempt is linked to this partner.',
      href: '/bookings?view=blocked-create',
      tone: 'pill-neutral',
      value: '0 attempt(s)',
    });
    expect(linkByLabel(links, 'KYC and documents')).toMatchObject({
      detail: '2 required document(s) missing approval.',
      tone: 'pill-warn',
      value: 'DRAFT',
    });
    expect(links.map((link) => link.label)).not.toEqual(
      expect.arrayContaining(['Withdrawal details', 'Tax profile optional']),
    );
  });
});

function linkByLabel(
  links: readonly PartnerDetailConnectedRecordLink[],
  label: string,
): PartnerDetailConnectedRecordLink {
  const link = links.find((item) => item.label === label);
  if (!link) {
    throw new Error(`Missing connected record link: ${label}`);
  }
  return link;
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
        services: [{ id: 'service-1', service: { durationMin: 60, name: 'Thai Massage' } }],
        status: 'MATCHED',
      },
      lastMessage: 'On my way',
      relation: 'Selected',
    },
  ];
}

function buildProvider() {
  return {
    auditLogs: [
      {
        action: 'provider.ops_note.add',
        actor: { fullName: 'Ops' },
        createdAt: '2026-06-10T08:00:00.000Z',
        id: 'audit-1',
        metadata: { note: 'Manual partner note' },
        target: 'provider:partner-1',
      },
    ],
    currentLat: 10.78,
    currentLng: 106.7,
    currentLocationUpdatedAt: '2026-06-10T07:00:00.000Z',
    earnings: [{ status: 'AVAILABLE' }],
    id: 'partner-1',
    kyc: { status: 'APPROVED' },
    taxProfile: { status: 'MISSING' },
    verification: { status: 'APPROVED' },
  };
}
