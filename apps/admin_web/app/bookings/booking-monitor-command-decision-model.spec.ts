import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorCommandDecisionStrip } from './booking-monitor-command-decision-model';

describe('buildBookingMonitorCommandDecisionStrip', () => {
  it('prioritizes missing address snapshots from booking facts', () => {
    const strip = buildBookingMonitorCommandDecisionStrip({
      id: 'missing-address',
      status: 'OPEN_MATCHING',
    } as unknown as AdminBooking);

    expect(strip.status).toBe('Address check');
    expect(strip.primaryAction).toBe('Confirm service address');
  });

  it('prioritizes handoff repair for matched bookings without retained chat', () => {
    const strip = buildBookingMonitorCommandDecisionStrip({
      addressSnapshot: {
        addressText: 'Ho Chi Minh City service address',
        latitude: 10.77,
        longitude: 106.7,
      },
      id: 'matched-without-chat',
      selectedProvider: { id: 'partner-1', displayName: 'Partner One' },
      status: 'MATCHED',
    } as unknown as AdminBooking);

    expect(strip.status).toBe('Handoff repair');
    expect(strip.primaryAction).toBe('Repair chat handoff');
  });
});
