import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingLiveServiceSignals } from './booking-live-service-signals';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-live-service-signals',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

describe('bookingLiveServiceSignals', () => {
  it('shows missing operational signals when no Partner, chat, location, or payment is ready', () => {
    const signals = bookingLiveServiceSignals(
      booking({
        address: 'District 1 service address',
      }),
    );

    expect(signals).toEqual([
      {
        helper: 'District 1 service address',
        label: 'Service address pin',
        tone: 'pill-warn',
        value: 'No pin',
      },
      {
        helper: 'Ask Partner to share current location from chat.',
        label: 'Partner pin',
        tone: 'pill-danger',
        value: 'No Partner pin',
      },
      {
        helper: 'Calculated from the service address pin and latest Partner pin. It is not a route or ETA.',
        label: 'Approx. gap',
        tone: 'pill-info',
        value: 'Unknown',
      },
      {
        helper: 'No Partner assigned yet.',
        label: 'Service contact',
        tone: 'pill-warn',
        value: 'No Partner phone',
      },
      {
        helper: 'Chat opens after Partner selection/service start.',
        label: 'Chat',
        tone: 'pill-warn',
        value: 'Not ready',
      },
      {
        helper: 'No payment record created.',
        label: 'Payment',
        tone: 'pill-info',
        value: 'NONE',
      },
    ]);
  });

  it('uses selected Partner location, chat, and authorized payment states', () => {
    const signals = bookingLiveServiceSignals(
      booking({
        addressSnapshot: {
          addressText: 'District 3 service address',
          latitude: 10.762622,
          longitude: 106.660172,
        } as AdminBookingDetail['addressSnapshot'],
        chatRoom: {
          id: 'chat-room-live',
          messages: [{ id: 'message-1' }, { id: 'message-2' }],
        } as AdminBookingDetail['chatRoom'],
        payment: {
          method: 'CARD',
          providerRef: 'auth-1',
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
          locationSnapshots: [
            {
              id: 'location-1',
              lat: 10.7627,
              lng: 106.6603,
              recordedAt: '2999-01-01T00:00:00.000Z',
            },
          ],
          user: { phone: '+84123456789' },
        } as AdminBookingDetail['selectedProvider'],
        status: 'PROVIDER_ON_THE_WAY',
      }),
    );

    expect(signals.find((signal) => signal.label === 'Service address pin')).toMatchObject({
      tone: 'pill-success',
      value: '10.7626, 106.6602',
    });
    expect(signals.find((signal) => signal.label === 'Partner pin')).toMatchObject({
      helper: 'Updated just now',
      tone: 'pill-success',
      value: '10.7627, 106.6603',
    });
    expect(signals.find((signal) => signal.label === 'Service contact')).toMatchObject({
      helper: 'Linh Partner is the current handoff Partner.',
      tone: 'pill-success',
      value: '+84123456789',
    });
    expect(signals.find((signal) => signal.label === 'Chat')).toMatchObject({
      helper: 'Room chat-room-live',
      tone: 'pill-success',
      value: '2 message(s)',
    });
    expect(signals.find((signal) => signal.label === 'Payment')).toMatchObject({
      helper: 'Hold is active; capture after service completion.',
      tone: 'pill-warn',
      value: 'AUTHORIZED',
    });
  });

  it('marks captured payments as terminal while keeping distance visible', () => {
    const signals = bookingLiveServiceSignals(
      booking({
        lat: 10.762622,
        lng: 106.660172,
        payment: {
          method: 'CARD',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        participants: [
          {
            providerProfile: {
              locationSnapshots: [
                {
                  id: 'participant-location-1',
                  lat: 10.7627,
                  lng: 106.6603,
                  recordedAt: '2999-01-01T00:00:00.000Z',
                },
              ],
            },
          },
        ] as AdminBookingDetail['participants'],
      }),
    );

    expect(signals.find((signal) => signal.label === 'Approx. gap')).toMatchObject({
      tone: 'pill-success',
      value: '0 m',
    });
    expect(signals.find((signal) => signal.label === 'Payment')).toMatchObject({
      helper: 'Payment captured.',
      tone: 'pill-success',
      value: 'CAPTURED',
    });
  });
});
