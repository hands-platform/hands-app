import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingNeedsChatHandoffEvidence,
  bookingNeedsCloseoutEvidence,
  bookingsMissingChatHandoffEvidence,
  bookingsMissingCloseoutEvidence,
} from './operations-handoff-booking-evidence';

describe('operations handoff booking evidence', () => {
  it('flags matched and active booking rows that still need chat handoff evidence', () => {
    const rows = [
      booking({ id: 'matched', status: 'MATCHED', chatRoom: null }),
      booking({ id: 'on-way', status: 'PROVIDER_ON_THE_WAY', chatRoom: null }),
      booking({ id: 'arrived', status: 'ARRIVED', chatRoom: null }),
      booking({ id: 'in-service', status: 'IN_SERVICE', chatRoom: null }),
      booking({ id: 'open', status: 'OPEN_MATCHING', chatRoom: null }),
      booking({ id: 'ready', status: 'MATCHED', chatRoom: { id: 'chat-1' } }),
    ];

    expect(rows.filter(bookingNeedsChatHandoffEvidence).map((row) => row.id)).toEqual([
      'matched',
      'on-way',
      'arrived',
      'in-service',
    ]);
    expect(bookingsMissingChatHandoffEvidence(rows).map((row) => row.id)).toEqual([
      'matched',
      'on-way',
      'arrived',
      'in-service',
    ]);
  });

  it('flags completed booking rows missing payment, earning, or chat evidence', () => {
    const rows = [
      booking({ id: 'missing-payment', status: 'COMPLETED', payment: null }),
      booking({ id: 'missing-earning', status: 'COMPLETED', earning: null }),
      booking({ id: 'missing-chat', status: 'COMPLETED', chatRoom: null }),
      booking({ id: 'ready', status: 'COMPLETED' }),
      booking({ id: 'matched', status: 'MATCHED', payment: null, earning: null, chatRoom: null }),
    ];

    expect(rows.filter(bookingNeedsCloseoutEvidence).map((row) => row.id)).toEqual([
      'missing-payment',
      'missing-earning',
      'missing-chat',
    ]);
    expect(bookingsMissingCloseoutEvidence(rows).map((row) => row.id)).toEqual([
      'missing-payment',
      'missing-earning',
      'missing-chat',
    ]);
  });
});

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    chatRoom: { id: 'chat-1' },
    earning: { id: 'earning-1' },
    id: 'booking-1',
    payment: { id: 'payment-1' },
    status: 'MATCHED',
    ...input,
  } as AdminBooking;
}
