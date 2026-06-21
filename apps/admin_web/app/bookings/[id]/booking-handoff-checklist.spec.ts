import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingHandoffChecklist } from './booking-handoff-checklist';

type BookingParticipant = NonNullable<AdminBookingDetail['participants']>[number];

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-test',
    participants: [],
    services: [{ service: { durationMin: 90, name: 'Deep Tissue' } }],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function participant(input: Partial<BookingParticipant>): BookingParticipant {
  return input as BookingParticipant;
}

function location(input: Partial<AdminLocationSnapshot>): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.762622,
    lng: 106.660172,
    recordedAt: '2026-06-14T01:10:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('booking handoff checklist', () => {
  it('summarizes request, Partner choice, chat, location, and finance handoff facts', () => {
    const rows = bookingHandoffChecklist(
      booking({
        addressSnapshot: {
          addressText: 'District 1 service address',
          createdAt: '2026-06-14T01:02:00.000Z',
        } as AdminBookingDetail['addressSnapshot'],
        chatRoom: { id: 'chat-room-123456' },
        earning: {
          currency: 'VND',
          netAmount: -150000,
          status: 'PENDING',
        } as AdminBookingDetail['earning'],
        openedAt: '2026-06-14T01:05:00.000Z',
        participants: [
          participant({
            id: 'participant-first',
            providerProfileId: 'partner-first',
            status: 'JOINED',
          }),
          participant({
            id: 'participant-selected',
            providerProfileId: 'partner-selected',
            status: 'SELECTED',
            providerProfile: {
              id: 'partner-selected',
              displayName: 'Selected Partner',
            },
          }),
        ],
        payment: {
          amount: 300000,
          currency: 'VND',
          method: 'CASH',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        preferredProviderId: 'partner-first',
        selectedProviderId: 'partner-selected',
      }),
      3,
      location({}),
    );

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      id: 'booking-request',
      title: 'Deep Tissue / 90 min',
      status: 'Booking facts',
    });
    expect(rows[0].detail).toContain('MATCHED / opened 14 Jun 2026, 08:05');
    expect(rows[0].detail).toContain('District 1 service address');
    expect(rows[1]).toMatchObject({
      id: 'partner-response',
      detail:
        '2 participant record(s) / 1 customer-selectable. The customer remains the final decision maker.',
      title: 'Selected Partner',
    });
    expect(rows[3].detail).toContain('3 retained message(s)');
    expect(rows[3].detail).toContain('10.7626, 106.6602');
    expect(rows[4]).toMatchObject({
      id: 'finance-closeout',
      title: 'CASH / CAPTURED / 300.000 VND',
    });
    expect(rows[4].detail).toContain('Cash fee debt must be settled');
    expect(rows[4].detail).toContain('before final acceptance, service start, or payout release');
    expect(rows[4].detail).not.toContain('marketplace bookings again');
    expect(rows[4].detail).toContain('Earning ledger: -150.000 VND.');
  });

  it('keeps missing chat, location, and payment states explicit', () => {
    const rows = bookingHandoffChecklist(
      booking({
        payment: null,
        selectedProviderId: null,
        status: 'OPEN_MATCHING',
      }),
      0,
    );

    expect(rows[1]).toMatchObject({
      title: 'Waiting for Partner response',
    });
    expect(rows[2]).toMatchObject({
      title: 'Customer choice pending',
    });
    expect(rows[3]).toMatchObject({
      title: 'Chat handoff pending',
    });
    expect(rows[3].detail).toContain('No Partner service location has been shared yet.');
    expect(rows[4]).toMatchObject({
      title: 'No payment record',
    });
  });
});
