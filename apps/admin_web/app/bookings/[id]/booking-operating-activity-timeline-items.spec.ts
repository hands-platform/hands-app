import type { AdminBookingDetail, AdminNotification } from '../../../lib/admin-api';
import { bookingOperatingActivityTimelineItems } from './booking-operating-activity-timeline-items';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-activity-timeline',
    status: 'COMPLETED',
    ...input,
  } as AdminBookingDetail;
}

function notification(input: Partial<AdminNotification>): AdminNotification {
  return {
    body: 'Body text',
    createdAt: '2026-06-14T01:00:00.000Z',
    data: { bookingId: 'booking-activity-timeline' },
    id: 'notification-1',
    title: 'Booking alert',
    type: 'booking.matched',
    ...input,
  } as AdminNotification;
}

describe('bookingOperatingActivityTimelineItems', () => {
  it('adds the review item before other activity groups', () => {
    const items = bookingOperatingActivityTimelineItems({
      booking: booking({
        review: {
          createdAt: '2026-06-14T02:00:00.000Z',
          id: 'review-1',
          rating: 5,
          status: 'PUBLISHED',
        },
      }),
      notifications: [],
    });

    expect(items).toEqual([
      expect.objectContaining({
        detail: 'Saved numeric input 5/5.',
        id: 'review-review-1',
        status: 'Feedback',
        title: 'Customer service feedback submitted',
        type: 'REVIEW',
      }),
    ]);
  });

  it('filters booking notifications, sorts newest first, and caps the timeline alert rows', () => {
    const items = bookingOperatingActivityTimelineItems({
      booking: booking({}),
      notifications: [
        notification({
          createdAt: '2026-06-14T01:00:00.000Z',
          id: 'alert-old',
          title: 'Old alert',
        }),
        notification({
          createdAt: '2026-06-14T05:00:00.000Z',
          id: 'alert-newest',
          title: 'Newest alert',
        }),
        notification({
          createdAt: '2026-06-14T03:00:00.000Z',
          id: 'alert-third',
          title: 'Third alert',
        }),
        notification({
          createdAt: '2026-06-14T04:00:00.000Z',
          id: 'alert-second',
          title: 'Second alert',
        }),
        notification({
          createdAt: '2026-06-14T02:00:00.000Z',
          id: 'alert-fifth',
          title: 'Fifth alert',
        }),
        notification({
          data: { bookingId: 'other-booking' },
          id: 'other-booking-alert',
          title: 'Other booking',
        }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual([
      'notification-alert-newest',
      'notification-alert-second',
      'notification-alert-third',
      'notification-alert-fifth',
    ]);
    expect(items[0]).toMatchObject({
      detail: 'Booking Matched / Body text',
      status: 'Alert',
      title: 'Newest alert',
      type: 'ALERT',
    });
  });

  it('adds ops tasks with a default detail when the task has no note', () => {
    const items = bookingOperatingActivityTimelineItems({
      booking: booking({
        opsTasks: [
          {
            bookingId: 'booking-activity-timeline',
            id: 'task-1',
            status: 'OPEN',
            type: 'chat_repair',
            updatedAt: '2026-06-14T06:00:00.000Z',
          },
        ],
      }),
      notifications: [],
    });

    expect(items).toEqual([
      expect.objectContaining({
        detail: 'Operator checklist task updated.',
        id: 'ops-task-task-1',
        status: 'OPEN',
        title: 'Chat Repair / OPEN',
        type: 'OPS',
      }),
    ]);
  });

  it('caps audit rows and summarizes metadata before falling back to target', () => {
    const items = bookingOperatingActivityTimelineItems({
      booking: booking({
        auditLogs: Array.from({ length: 8 }, (_, index) => ({
          action: index === 0 ? 'payment.release' : 'booking.note',
          createdAt: `2026-06-14T0${index}:00:00.000Z`,
          id: `audit-${index}`,
          metadata:
            index === 0
              ? { amount: 300000, reason: 'Refund release' }
              : {},
          target: `booking:${index}`,
        })),
      }),
      notifications: [],
    });

    expect(items).toHaveLength(6);
    expect(items[0]).toMatchObject({
      detail: 'reason: Refund release / amount: 300,000',
      id: 'audit-audit-0',
      title: 'Payment Release',
      type: 'AUDIT',
    });
    expect(items[1]).toMatchObject({
      detail: 'booking:1',
      id: 'audit-audit-1',
    });
  });
});
