import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingMonitorAddressState,
  buildBookingMonitorChatState,
  buildBookingMonitorListLocation,
} from './booking-monitor-list-state-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('booking monitor list state model', () => {
  it('builds address state from an immutable booking snapshot', () => {
    expect(
      buildBookingMonitorAddressState({
        addressSnapshot: {
          addressText: 'District 1',
          latitude: 10.77,
          longitude: 106.7,
        },
      } as AdminBooking),
    ).toMatchObject({
      detail: 'District 1',
      label: 'Address locked',
      tone: 'pill-success',
    });
  });

  it('marks matched bookings without chat as missing chat', () => {
    expect(
      buildBookingMonitorChatState({
        status: 'MATCHED',
      } as AdminBooking),
    ).toEqual({
      detail: 'Customer and Partner are matched, but no chat room is linked yet.',
      label: 'Chat missing',
      tone: 'pill-danger',
    });
  });

  it('builds Partner location labels from selected Partner coordinates', () => {
    expect(
      buildBookingMonitorListLocation(
        {
          selectedProvider: {
            currentLat: '10.77',
            currentLng: '106.7',
            currentLocationUpdatedAt: '2026-06-07T09:40:00.000Z',
          },
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toEqual({
      pillLabel: 'Location recent',
      signalLabel: 'Partner location: updated 20m ago',
      toneClass: 'pill-success',
    });
  });
});
