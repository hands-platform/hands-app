import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorCustomerVisibleStateLabel } from './booking-monitor-customer-visible-model';

describe('buildBookingMonitorCustomerVisibleStateLabel', () => {
  it('builds first-pick plus marketplace option copy from booking facts', () => {
    expect(
      buildBookingMonitorCustomerVisibleStateLabel({
        id: 'open-with-options',
        preferredProvider: { id: 'preferred-1', displayName: 'First Pick' },
        preferredProviderId: 'preferred-1',
        status: 'OPEN_MATCHING',
        participants: [
          { providerProfile: { id: 'preferred-1' }, status: 'REQUESTED' },
          { providerProfile: { id: 'marketplace-1' }, status: 'JOINED' },
          { providerProfile: { id: 'marketplace-2' }, status: 'ACCEPTED' },
        ],
      } as unknown as AdminBooking),
    ).toBe('Customer screen: 2 participating/accepted partner(s) ready for final choice');
  });

  it('builds final partner chat-ready copy for matched bookings', () => {
    expect(
      buildBookingMonitorCustomerVisibleStateLabel({
        chatRoom: { id: 'chat-1' },
        id: 'matched',
        selectedProvider: { displayName: 'Selected Partner' },
        status: 'MATCHED',
      } as unknown as AdminBooking),
    ).toBe('Customer screen: final partner Selected Partner with chat ready');
  });
});
