import type { AdminBookingDetail, AdminNotification } from '../../../lib/admin-api';
import { bookingNotificationTrace, bookingNotificationTraceRow } from './booking-notification-trace';

describe('booking notification trace', () => {
  it('reads current marketplace fields from Partner alert notification data', () => {
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

    expect(row.createdAtValue).toBe('2026-06-07T01:00:00.000Z');
    expect(row.createdAtLabel).toBeTruthy();
    expect(row.meta).toContain('marketplace radius 5 km');
    expect(row.meta).toContain('invite cap 25');
    expect(row.meta).toContain('marketplace mode IMMEDIATE_WITHIN_WINDOW');
  });

  it('surfaces stale push token evidence in booking notification traces', () => {
    const notification = {
      id: 'notification-stale',
      type: 'booking.matched',
      title: 'Partner matched',
      body: 'A Partner accepted the booking.',
      createdAt: '2026-06-07T01:00:00.000Z',
      data: { bookingId: 'booking-1' },
      deliveries: [
        {
          id: 'delivery-stale',
          provider: 'FCM',
          status: 'SENT',
          attemptedAt: '2026-06-07T01:00:00.000Z',
          pushDevice: {
            id: 'device-stale',
            enabled: true,
            platform: 'android',
            lastSeenAt: '2026-04-20T01:00:00.000Z',
          },
        },
      ],
    } as AdminNotification;

    const row = bookingNotificationTraceRow(notification);
    const trace = bookingNotificationTrace({ id: 'booking-1', status: 'MATCHED' } as AdminBookingDetail, [
      notification,
    ]);

    expect(row.staleDeviceCount).toBe(1);
    expect(row.delivery).toContain('30+ day token timestamp');
    expect(trace.metrics).toContainEqual({
      label: 'Stale devices',
      value: '1',
      helper: 'App should refresh FCM token before retry.',
    });
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

    expect(trace.backupBatches[0]?.createdAtValue).toBe('2026-06-07T01:00:00.000Z');
    expect(trace.backupBatches[0]?.createdAtLabel).toBeTruthy();
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
