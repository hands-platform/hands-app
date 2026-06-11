import type { AdminBookingDetail, AdminNotification } from '../../../lib/admin-api';
import { bookingNotificationTrace, bookingNotificationTraceRow } from './booking-notification-trace';

describe('booking notification trace', () => {
  it('reads current marketplace fields from partner alert notification data', () => {
    const row = bookingNotificationTraceRow({
      id: 'notification-1',
      type: 'booking.backup_available',
      title: 'Marketplace booking available',
      body: 'A nearby customer is waiting.',
      createdAt: '2026-06-07T01:00:00.000Z',
      data: {
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
        distanceMeters: 1200,
        marketplaceRadiusMeters: 5000,
        marketplaceInvitationLimit: 25,
        marketplaceOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
      },
      deliveries: [],
    } as AdminNotification);

    expect(row.meta).toContain('marketplace radius 5 km');
    expect(row.meta).toContain('invite cap 25');
    expect(row.meta).toContain('marketplace mode IMMEDIATE_WITHIN_WINDOW');
  });

  it('reads current marketplace fields from saved invite batch traces', () => {
    const trace = bookingNotificationTrace(
      {
        id: 'booking-1',
        status: 'OPEN_MATCHING',
        metadata: {
          backupNotificationTraces: [
            {
              stage: 'booking.backup_available',
              createdAt: '2026-06-07T01:00:00.000Z',
              notifiedCount: 2,
              marketplaceRadiusMeters: 5000,
              marketplaceInvitationLimit: 25,
              marketplaceOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
              providers: [],
            },
          ],
        },
      } as AdminBookingDetail,
      [],
    );

    expect(trace.backupBatches[0]?.meta).toContain('radius 5 km');
    expect(trace.backupBatches[0]?.meta).toContain('invite cap 25');
    expect(trace.backupBatches[0]?.meta).toContain('mode IMMEDIATE_WITHIN_WINDOW');
  });

  it('sorts saved invite batch traces by creation time newest first', () => {
    const trace = bookingNotificationTrace(
      {
        id: 'booking-1',
        status: 'OPEN_MATCHING',
        metadata: {
          backupNotificationTraces: [
            {
              stage: 'initial_open',
              createdAt: '2026-06-07T01:00:00.000Z',
              notifiedCount: 1,
              providers: [],
            },
            {
              stage: 'first_pick_declined',
              createdAt: '2026-06-07T01:10:00.000Z',
              notifiedCount: 3,
              providers: [],
            },
          ],
        },
      } as AdminBookingDetail,
      [],
    );

    expect(trace.backupBatches.map((batch) => batch.notifiedCountLabel)).toEqual(['3', '1']);
  });
});
