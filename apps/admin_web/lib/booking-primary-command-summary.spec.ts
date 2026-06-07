import { bookingPrimaryCommandSummary } from './booking-primary-command-summary';
import type { BookingCommandDecisionStrip } from './booking-command-decision-strip';

function strip(
  status: string,
  primaryAction: string,
  tone: BookingCommandDecisionStrip['tone'],
  primaryDetail = 'Operator detail',
): BookingCommandDecisionStrip {
  return {
    status,
    primaryAction,
    primaryDetail,
    tone,
    rows: [],
  };
}

describe('bookingPrimaryCommandSummary', () => {
  it('groups booking command strips by primary status and action', () => {
    const summary = bookingPrimaryCommandSummary([
      {
        bookingId: 'booking-a',
        href: '/bookings?view=customer-choice',
        strip: strip('Customer choice', 'Keep customer final choice visible', 'pill-warn'),
      },
      {
        bookingId: 'booking-b',
        href: '/bookings?view=customer-choice',
        strip: strip('Customer choice', 'Keep customer final choice visible', 'pill-warn'),
      },
      {
        bookingId: 'booking-c',
        href: '/bookings?view=chat-repair',
        strip: strip('Handoff repair', 'Repair chat handoff', 'pill-danger'),
      },
    ]);

    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({
      status: 'Handoff repair',
      primaryAction: 'Repair chat handoff',
      tone: 'pill-danger',
      count: 1,
      sampleBookingIds: ['booking-c'],
    });
    expect(summary[1]).toMatchObject({
      status: 'Customer choice',
      primaryAction: 'Keep customer final choice visible',
      tone: 'pill-warn',
      count: 2,
      sampleBookingIds: ['booking-a', 'booking-b'],
    });
  });

  it('keeps the first detail and limits sample booking ids', () => {
    const summary = bookingPrimaryCommandSummary(
      Array.from({ length: 5 }, (_, index) => ({
        bookingId: `booking-${index + 1}`,
        href: '/bookings?view=matching',
        strip: strip(
          'Matching watch',
          'Monitor marketplace participation',
          'pill-info',
          index === 0 ? 'First detail wins.' : 'Later detail.',
        ),
      })),
    );

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      count: 5,
      detail: 'First detail wins.',
      sampleBookingIds: ['booking-1', 'booking-2', 'booking-3'],
    });
  });
});
