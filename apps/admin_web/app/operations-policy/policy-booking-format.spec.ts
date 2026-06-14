import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingCustomerLabel,
  bookingPartnerLabel,
  bookingServiceLabel,
  bookingWalletLedgerTotal,
  byNewestBooking,
  shortId,
} from './policy-booking-format';

describe('operations policy booking format helpers', () => {
  it('formats booking labels and wallet totals for policy review surfaces', () => {
    const booking = {
      customerProfile: { user: { fullName: 'Customer One' } },
      earning: { walletLedgerEntries: [{ amount: '-12000' }, { amount: '2000' }] },
      id: 'cmqbcwjy00123456789',
      preferredProvider: { displayName: 'Partner One' },
      services: [{ service: { durationMin: 45, name: 'Foot Massage' } }],
    } as unknown as AdminBooking;

    expect(bookingServiceLabel(booking)).toBe('Foot Massage (45 min)');
    expect(bookingPartnerLabel(booking)).toBe('Partner One');
    expect(bookingCustomerLabel(booking)).toBe('Customer One');
    expect(bookingWalletLedgerTotal(booking)).toBe(-10000);
    expect(shortId(booking.id)).toBe('cmqbcwjy...6789');
  });

  it('sorts newest bookings first and keeps Partner fallback copy', () => {
    const older = { createdAt: '2026-01-01T00:00:00.000Z' } as AdminBooking;
    const newer = { createdAt: '2026-01-02T00:00:00.000Z' } as AdminBooking;
    const withParticipant = { participants: [{ providerProfile: {} }] } as unknown as AdminBooking;

    expect([older, newer].sort(byNewestBooking)).toEqual([newer, older]);
    expect(bookingPartnerLabel(withParticipant)).toBe('Participating Partner');
    expect(bookingPartnerLabel({} as AdminBooking)).toBe('No Partner yet');
  });
});
