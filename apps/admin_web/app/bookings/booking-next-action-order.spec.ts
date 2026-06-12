import {
  compareBookingNextActionOrder,
  orderedBookingNextActions,
  type BookingNextActionOrderFact,
} from './booking-next-action-order';

describe('booking next action order', () => {
  it('orders by command tone before timestamp', () => {
    const actions = [
      { id: 'info-new', tone: 'info', sortTimestampMs: 500 },
      { id: 'danger-old', tone: 'danger', sortTimestampMs: 100 },
      { id: 'warn-new', tone: 'warn', sortTimestampMs: 800 },
      { id: 'danger-new', tone: 'danger', sortTimestampMs: 300 },
    ] satisfies Array<BookingNextActionOrderFact & { readonly id: string }>;

    expect(
      actions.sort(compareBookingNextActionOrder).map((action) => action.id),
    ).toEqual(['danger-new', 'danger-old', 'warn-new', 'info-new']);
  });

  it('limits ordered actions to the visible next-action count', () => {
    expect(
      orderedBookingNextActions(
        [
          { id: 'one', tone: 'info', sortTimestampMs: 1 },
          { id: 'two', tone: 'danger', sortTimestampMs: 2 },
          { id: 'three', tone: 'warn', sortTimestampMs: 3 },
        ],
        (action) => action.sortTimestampMs,
        2,
      ).map((action) => action.id),
    ).toEqual(['two', 'three']);
  });

  it('does not mutate the source array', () => {
    const actions = [
      { id: 'low', tone: 'info', sortTimestampMs: 1 },
      { id: 'high', tone: 'danger', sortTimestampMs: 1 },
    ] as const;

    expect(
      orderedBookingNextActions(actions, (action) => action.sortTimestampMs).map(
        (action) => action.id,
      ),
    ).toEqual(['high', 'low']);
    expect(actions.map((action) => action.id)).toEqual(['low', 'high']);
  });
});
