import { bookingPrimaryCommandHref } from './booking-primary-command-href';

describe('bookingPrimaryCommandHref', () => {
  it.each([
    ['Address check', '/bookings?view=address'],
    ['Handoff repair', '/bookings?view=chat-repair'],
    ['Finance gate', '/bookings?view=cash-debt'],
    ['Customer choice', '/bookings?view=customer-choice'],
    ['Matching watch', '/bookings?view=matching'],
    ['Payment review', '/bookings?view=payment'],
    ['Closeout review', '/bookings?view=closeout'],
  ])('maps %s to %s', (status, href) => {
    expect(bookingPrimaryCommandHref(status)).toBe(href);
  });

  it('falls back to the all bookings view', () => {
    expect(bookingPrimaryCommandHref('Unknown command')).toBe('/bookings?view=all');
  });
});
