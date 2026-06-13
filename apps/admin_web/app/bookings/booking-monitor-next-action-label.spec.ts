import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorNextActionLabel } from './booking-monitor-next-action-label';

describe('bookingMonitorNextActionLabel', () => {
  it('builds first-pick guidance from booking facts', () => {
    expect(
      bookingMonitorNextActionLabel({
        preferredProvider: { id: 'preferred-1' },
        preferredProviderId: 'preferred-1',
        status: 'OPEN_MATCHING',
        participants: [{ providerProfile: { id: 'preferred-1' }, status: 'REQUESTED' }],
      } as unknown as AdminBooking),
    ).toBe('Wait for the first-pick partner, but monitor marketplace partner supply.');
  });

  it('builds completed closeout guidance from booking facts', () => {
    expect(
      bookingMonitorNextActionLabel({
        status: 'COMPLETED',
      } as unknown as AdminBooking),
    ).toBe(
      'Completed service needs closeout reconciliation for payment, earning, tax, and wallet records.',
    );
  });
});
