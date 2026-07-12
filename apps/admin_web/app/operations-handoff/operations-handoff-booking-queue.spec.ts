import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingPartnerName,
  bookingStatusClass,
  buildBookingHandoffQueue,
} from './operations-handoff-booking-queue';

describe('operations handoff booking queue model', () => {
  it('keeps active bookings and recently changed inactive bookings in the handoff queue', () => {
    const rows = buildBookingHandoffQueue(
      [
        booking({
          id: 'active-open',
          status: 'OPEN_MATCHING',
          updatedAt: '2026-06-14T10:00:00.000Z',
          preferredProvider: { displayName: 'Provider Linh', id: 'partner-linh' },
          participants: [
            {
              id: 'participant-backup',
              providerProfile: { displayName: 'Provider Backup', id: 'partner-backup' },
              status: 'JOINED',
            },
          ],
          payment: {
            amount: 150000,
            currency: 'VND',
            method: 'CASH',
            status: 'AUTHORIZED',
          },
        }),
        booking({
          id: 'recent-completed',
          status: 'COMPLETED',
          updatedAt: '2026-06-14T09:30:00.000Z',
          selectedProvider: { displayName: 'Partner Mai', id: 'partner-mai', status: 'ONLINE_AVAILABLE' },
          chatRoom: { id: 'chat-1' },
          earning: {
            bookingId: 'recent-completed',
            currency: 'VND',
            grossAmount: 0,
            id: 'earning-recent-completed',
            netAmount: -50000,
            platformFee: 0,
            providerProfileId: 'partner-mai',
            status: 'AVAILABLE',
            withholdingAmount: 0,
          },
        }),
        booking({
          id: 'old-completed',
          status: 'COMPLETED',
          updatedAt: '2026-06-14T06:00:00.000Z',
        }),
      ],
      { nowMs: Date.parse('2026-06-14T10:30:00.000Z') },
    );

    expect(rows.map((row) => row.id)).toEqual(['active-open', 'recent-completed']);
    expect(rows[0]).toMatchObject({
      chatLabel: 'Chat not created',
      customerAvatarStatus: 'matching',
      customerHref: '/customers/customer-a',
      partnerAvatarStatus: 'matching',
      partnerDetail: 'Preferred Partner / 1 participant(s)',
      partnerHref: '/partners/partner-linh',
      partnerName: 'Partner Linh',
      paymentLabel: 'CASH / AUTHORIZED / 150.000 VND',
      reviewReason: 'Open matching window needs Partner response and customer choice.',
      statusClass: 'pill pill-warn',
    });
    expect(rows[1]).toMatchObject({
      chatLabel: 'Chat archived',
      customerAvatarStatus: 'offline',
      partnerDetail: 'Selected Partner',
      partnerAvatarStatus: 'online',
      partnerHref: '/partners/partner-mai',
      reviewReason: 'Negative wallet effect needs finance review.',
      walletLabel: 'Wallet effect -50.000 VND',
    });
  });

  it('uses participant names and generic status classes as fallbacks', () => {
    const bookingWithoutDirectPartner = booking({
      status: 'PENDING_REVIEW',
      participants: [
        {
          id: 'participant-backup',
          providerProfile: { displayName: 'Provider Backup', id: 'partner-backup' },
          status: 'JOINED',
        },
      ],
    });

    expect(bookingPartnerName(bookingWithoutDirectPartner)).toBe('Partner Backup');
    expect(bookingStatusClass('PENDING_REVIEW')).toBe('pill');
  });
});

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    createdAt: '2026-06-14T08:00:00.000Z',
    customerProfile: {
      id: 'customer-a',
      user: {
        fullName: 'Customer A',
        phone: '+84900000001',
      },
    },
    id: 'booking-test',
    participants: [],
    status: 'OPEN_MATCHING',
    updatedAt: '2026-06-14T08:00:00.000Z',
    ...input,
  } as AdminBooking;
}
