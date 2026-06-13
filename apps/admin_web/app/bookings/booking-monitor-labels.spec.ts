import type { AdminBooking } from '../../lib/admin-api';
import { bookingCustomerLabel, bookingProviderLabel, partnerDisplayName } from './booking-monitor-labels';

describe('booking monitor labels', () => {
  it('prefers customer full name, then phone, then generic customer label', () => {
    expect(
      bookingCustomerLabel({
        customerProfile: { user: { fullName: 'Linh Nguyen', phone: '+84900000000' } },
      } as AdminBooking),
    ).toBe('Linh Nguyen');

    expect(bookingCustomerLabel({ customerProfile: { user: { phone: '+84900000000' } } } as AdminBooking)).toBe(
      '+84900000000',
    );
    expect(bookingCustomerLabel({} as AdminBooking)).toBe('Customer');
  });

  it('uses final, preferred, then marketplace participant partner names', () => {
    expect(
      bookingProviderLabel({
        selectedProvider: { displayName: 'Final Provider' },
        preferredProvider: { displayName: 'Preferred Partner' },
      } as AdminBooking),
    ).toBe('Partner Final Partner');

    expect(
      bookingProviderLabel({
        preferredProvider: { displayName: 'Preferred Partner' },
      } as AdminBooking),
    ).toBe('Partner Preferred Partner');

    expect(
      bookingProviderLabel({
        participants: [
          { providerProfile: { displayName: 'Marketplace Provider', id: 'partner-1' }, status: 'JOINED' },
        ],
      } as AdminBooking),
    ).toBe('Partner Marketplace Partner');
  });

  it('normalizes provider copy in fallback labels', () => {
    expect(partnerDisplayName({ displayName: 'Provider One' })).toBe('Partner One');
    expect(partnerDisplayName(null, 'none')).toBe('none');
  });
});
