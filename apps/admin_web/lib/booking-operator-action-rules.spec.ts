import {
  bookingExpiryEligibility,
  bookingOperatorAuditNotes,
  bookingOperatorNoteLines,
  canExpireBooking,
  canMarkNoShow,
} from './booking-operator-action-rules';

describe('booking operator action rules', () => {
  it('allows expiry only after a stored deadline with no final Partner', () => {
    const expired = {
      customerChoiceCandidateCount: 0,
      expiresAt: '2026-08-05T12:00:00.000Z',
      nowMs: new Date('2026-08-05T12:01:00.000Z').getTime(),
      selectedProviderId: null,
      status: 'OPEN_MATCHING',
    } as const;

    expect(canExpireBooking(expired)).toBe(true);
    expect(canExpireBooking({ ...expired, status: 'MATCHED' })).toBe(false);
    expect(canExpireBooking({ ...expired, expiresAt: null })).toBe(false);
    expect(canExpireBooking({ ...expired, selectedProviderId: 'partner-1' })).toBe(false);
  });

  it('keeps customer choice ahead of expiry before the deadline', () => {
    expect(
      bookingExpiryEligibility({
        customerChoiceCandidateCount: 1,
        expiresAt: '2026-08-05T12:10:00.000Z',
        nowMs: new Date('2026-08-05T12:01:00.000Z').getTime(),
        selectedProviderId: null,
        status: 'OPEN_MATCHING',
      }),
    ).toEqual({ allowed: false, reason: 'SELECTABLE_CANDIDATE_EXISTS' });
  });

  it('allows an admin-expired booking to retry its incomplete closeout', () => {
    expect(
      bookingExpiryEligibility({
        closedReason: 'admin_expired',
        customerChoiceCandidateCount: 0,
        expiresAt: '2026-08-05T12:00:00.000Z',
        closeoutRecoveryPending: true,
        selectedProviderId: null,
        status: 'EXPIRED',
      }),
    ).toEqual({ allowed: true, reason: 'CLOSEOUT_RECOVERY' });
  });

  it('allows no-show marking only before service completion or cancellation', () => {
    expect(canMarkNoShow('OPEN_MATCHING')).toBe(true);
    expect(canMarkNoShow('MATCHED')).toBe(true);
    expect(canMarkNoShow('PROVIDER_ON_THE_WAY')).toBe(true);
    expect(canMarkNoShow('ARRIVED')).toBe(true);
    expect(canMarkNoShow('IN_SERVICE')).toBe(false);
    expect(canMarkNoShow('COMPLETED')).toBe(false);
    expect(canMarkNoShow('CANCELLED')).toBe(false);
  });

  it('normalizes operator notes into non-empty trimmed lines', () => {
    expect(bookingOperatorNoteLines(' first note \n\n second note  ')).toEqual(['first note', 'second note']);
    expect(bookingOperatorNoteLines(null)).toEqual([]);
    expect(bookingOperatorNoteLines(undefined)).toEqual([]);
  });

  it('keeps structured operator notes separate from other booking audit records', () => {
    expect(
      bookingOperatorAuditNotes([
        {
          action: 'booking.ops_note.add',
          actor: { fullName: 'Shift Lead' },
          createdAt: '2026-08-05T10:00:00.000Z',
          id: 'audit-1',
          metadata: { note: ' Customer contacted. ' },
          target: 'booking:booking-1',
        },
        {
          action: 'booking.expire.manual',
          createdAt: '2026-08-05T10:01:00.000Z',
          id: 'audit-2',
          metadata: { note: 'Not an operator note entry' },
          target: 'booking:booking-1',
        },
      ]),
    ).toEqual([
      {
        actorLabel: 'Shift Lead',
        content: 'Customer contacted.',
        createdAt: '2026-08-05T10:00:00.000Z',
        id: 'audit-1',
      },
    ]);
  });
});
