import { describe, expect, it } from 'vitest';

import type { PartnerActivityRecord } from './partner-detail-activity-model';
import type { PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import {
  buildPartnerActivityCommandSnapshot,
  buildPartnerBookingOpsLedgerRows,
  buildPartnerMasterFacts,
  latestPartnerAccessAt,
} from './partner-detail-record-summary-model';
import type { PartnerDetailBooking } from './partner-detail-record-helpers';
import type { ProviderDetail } from './partner-detail-types';

describe('partner detail record summary model', () => {
  const provider = {
    id: 'partner-1',
    status: 'ONLINE',
    displayName: 'Moon',
    legalName: 'Nguyen Moon',
    user: {
      phone: '+84900000000',
      email: 'moon@example.com',
      createdAt: '2026-07-01T00:00:00.000Z',
      pushDevices: [{ enabled: true }],
    },
    appActivitySummary: { lastActiveAt: '2026-07-29T08:00:00.000Z' },
    sessions: [{ lastSeenAt: '2026-07-29T09:00:00.000Z' }],
    devices: [{ lastSeenAt: '2026-07-29T10:00:00.000Z' }],
    earnings: [
      {
        id: 'earning-1',
        grossAmount: 500_000,
        platformFee: 100_000,
        netAmount: 400_000,
        withholdingAmount: 0,
        status: 'AVAILABLE',
      },
    ],
    payoutBatches: [],
    reports: [],
    sanctions: [],
  } as unknown as ProviderDetail;

  const booking = {
    id: 'booking-123456789',
    status: 'COMPLETED',
    createdAt: '2026-07-28T08:00:00.000Z',
    notes: 'First note\nLatest note',
    closedAt: '2026-07-28T10:00:00.000Z',
    closedByRole: 'ADMIN',
    closedReason: 'COMPLETED_REVIEW',
    customerProfile: { user: { fullName: 'Customer One' } },
    services: [{ id: 'service-1', service: { name: 'Massage' } }],
    chatRoom: {
      id: 'chat-1',
      messages: [
        {
          id: 'message-1',
          body: 'Hello',
          createdAt: '2026-07-28T08:30:00.000Z',
        },
      ],
    },
    opsTasks: [
      {
        id: 'task-1',
        type: 'FOLLOW_UP',
        status: 'DONE',
        note: 'Checked',
        createdAt: '2026-07-28T09:00:00.000Z',
        actor: { fullName: 'Operator' },
      },
    ],
  } satisfies PartnerDetailBooking;

  const bookingArchive: PartnerBookingArchiveRecord<PartnerDetailBooking>[] = [
    { relation: 'Selected', booking, lastMessage: 'Hello' },
  ];

  it('builds the summary, master facts, and bounded operations ledger from the same records', () => {
    const records: PartnerActivityRecord[] = [
      {
        id: 'activity-1',
        type: 'BOOKING',
        at: '2026-07-28T08:00:00.000Z',
        title: 'Booking completed',
        detail: 'Completed work',
      },
    ];

    expect(latestPartnerAccessAt(provider)).toBe('2026-07-29T10:00:00.000Z');

    const commandSnapshot = buildPartnerActivityCommandSnapshot(
      provider,
      records,
      bookingArchive,
      { status: 'UNLOCKED' },
      'Last 7 days',
      'All activity',
    );
    expect(commandSnapshot.find((item) => item.label === 'Completed work')?.value).toBe('1 booking(s)');
    expect(commandSnapshot.find((item) => item.label === 'Retained chat')?.value).toBe('1 message(s)');

    const facts = buildPartnerMasterFacts(
      provider,
      bookingArchive,
      null,
      { status: 'UNLOCKED' },
      { bookableServices: '1 / 1' },
      0,
    );
    expect(facts.find((fact) => fact.label === 'Bookings')?.value).toBe('1 total');
    expect(facts.find((fact) => fact.label === 'Services')?.value).toBe('1 / 1');

    const ledger = buildPartnerBookingOpsLedgerRows(bookingArchive);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      noteDetail: 'Latest note',
      taskStatus: '1 task row(s)',
      closeoutStatus: 'Closed by operator flow',
    });
  });
});
