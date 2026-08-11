import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorListStage } from './booking-monitor-list-stage-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('buildBookingMonitorListStage', () => {
  it('builds first-pick stage from an open matching booking', () => {
    expect(
      buildBookingMonitorListStage(
        {
          expiresAt: '2026-06-07T09:45:00.000Z',
          id: 'booking-1',
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toMatchObject({
      key: 'first-pick',
      label: 'Preferred pending',
      tone: 'danger',
    });
  });

  it('builds customer choice stage from selectable marketplace participants', () => {
    expect(
      buildBookingMonitorListStage(
        {
          id: 'booking-2',
          participants: [
            { providerProfile: { id: 'partner-1' }, status: 'JOINED' },
            { providerProfile: { id: 'partner-2' }, status: 'ACCEPTED' },
          ],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toMatchObject({
      key: 'customer-choice',
      label: 'Customer choice',
      tone: 'warn',
    });
  });
});
