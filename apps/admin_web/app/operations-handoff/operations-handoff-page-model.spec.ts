import { auditActivityArea, relatedHref } from './operations-handoff-activity-stream';

describe('operations handoff page model', () => {
  it('links notification audit activity rows to filtered notification audit evidence', () => {
    const href = relatedHref({
      action: 'notification.retry',
      actor: { fullName: 'Demo Admin' },
      createdAt: '2026-06-14T00:59:12.344Z',
      id: 'audit-1',
      metadata: { notificationId: 'notification-123' },
      target: 'notification:notification-123',
    });

    expect(href).toBe('/audit-log?bucket=Notification&q=notification-123&range=all');
  });

  it('labels notification audit activity separately from generic ops notes', () => {
    expect(
      auditActivityArea({
        action: 'notification.retry',
        createdAt: '2026-06-14T00:59:12.344Z',
        id: 'audit-1',
        target: 'notification:notification-123',
      }),
    ).toBe('Notification audit');

    expect(
      auditActivityArea({
        action: 'operations.handoff_note.add',
        createdAt: '2026-06-14T00:59:12.344Z',
        id: 'audit-2',
        target: 'operations:handoff',
      }),
    ).toBe('Ops note');
  });

  it('keeps booking audit rows linked to the booking detail first', () => {
    const href = relatedHref({
      action: 'notification.retry',
      createdAt: '2026-06-14T00:59:12.344Z',
      id: 'audit-1',
      metadata: { bookingId: 'booking-123', notificationId: 'notification-123' },
      target: 'notification:notification-123',
    });

    expect(href).toBe('/bookings/booking-123');
  });
});
