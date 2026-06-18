import type { AdminBooking } from '../../lib/admin-api';

import {
  bookingPostMatchChatEvidenceRows,
  bookingPostMatchEvidenceLabel,
} from './booking-post-match-chat-evidence';

function postMatchBooking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking_post_match_cancelled',
    status: 'CANCELLED',
    createdAt: '2026-06-13T02:55:00.000Z',
    matchedAt: '2026-06-13T03:00:00.000Z',
    closedAt: '2026-06-13T03:30:00.000Z',
    closedByRole: 'PROVIDER',
    closedReason: 'partner_cancelled_after_match',
    closedNote: 'Partner cancelled from chat.',
    selectedProviderId: 'partner_1',
    earning: {
      id: 'earning_1',
      netAmount: -30000,
      status: 'PENDING',
    },
    chatRoom: {
      id: 'chat_1',
      messages: [
        {
          id: 'message_1',
          body: 'I need to cancel after matching.',
          createdAt: '2026-06-13T03:29:00.000Z',
          sender: {
            fullName: 'Partner One',
            roles: ['PROVIDER'],
          },
        },
      ],
    },
    ...overrides,
  } as unknown as AdminBooking;
}

describe('bookingPostMatchChatEvidenceRows', () => {
  it('summarizes manual post-match cancellation evidence for admin review', () => {
    const rows = bookingPostMatchChatEvidenceRows({
      booking: postMatchBooking(),
      messageCount: 1,
    });

    expect(rows).toEqual([
      {
        label: 'Review state',
        value: 'Pending admin decision',
        helper: '30m after match / Fee held',
      },
      {
        label: 'Closure source',
        value: 'Partner',
        helper: 'Partner Cancelled After Match',
      },
      {
        label: 'Retained chat',
        value: '1 message',
        helper: 'Use this transcript before approving or holding the fee decision.',
      },
      {
        label: 'Closure note',
        value: 'Partner cancelled from chat.',
        helper: 'Partner cancellation context.',
      },
    ]);
  });

  it('uses retained booking messages when an explicit count is not supplied', () => {
    const rows = bookingPostMatchChatEvidenceRows({
      booking: postMatchBooking(),
    });

    expect(rows.find((row) => row.label === 'Retained chat')).toMatchObject({
      value: '1 message',
    });
  });

  it('skips bookings that are not post-match cancellation review records', () => {
    expect(
      bookingPostMatchChatEvidenceRows({
        booking: postMatchBooking({
          status: 'REQUESTED',
          matchedAt: null,
          selectedProviderId: null,
        }),
      }),
    ).toEqual([]);
  });

  it('labels no-show evidence separately from post-match cancellations', () => {
    const booking = postMatchBooking({ status: 'NO_SHOW' });

    expect(bookingPostMatchEvidenceLabel(booking)).toBe('No-show evidence');
  });
});
