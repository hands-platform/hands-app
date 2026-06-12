import type { AdminBooking } from '../../lib/admin-api';
import { bookingMatchingEscalationRowInput } from './booking-matching-escalation-row-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('bookingMatchingEscalationRowInput', () => {
  it('builds row input from booking data and matching escalation facts', () => {
    const item = booking({
      createdAt: '2026-06-12T09:40:00.000Z',
      id: 'booking-1',
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(
      bookingMatchingEscalationRowInput(item, {
        hasChatRoom: false,
        marketplaceCount: 2,
        preferredAwaitingDecision: true,
        responseWindowExpired: false,
        selectableCount: 1,
        selectionLabel: 'First-pick partner pending',
        selectionPathLabel: 'Direct request first, with marketplace partners already waiting',
        windowLabel: '5m left',
      }),
    ).toEqual({
      booking: item,
      hasChatRoom: false,
      hasPreferredPartner: true,
      marketplaceCount: 2,
      needsOps: true,
      preferredAwaitingDecision: true,
      responseWindowExpired: false,
      selectableCount: 1,
      selectionLabel: 'First-pick partner pending',
      selectionPathLabel: 'Direct request first, with marketplace partners already waiting',
      sortTimestamp: Date.parse('2026-06-12T09:40:00.000Z'),
      status: 'OPEN_MATCHING',
      windowLabel: '5m left',
    });
  });

  it('marks matched rows without chat as needing escalation', () => {
    expect(
      bookingMatchingEscalationRowInput(
        booking({
          id: 'booking-2',
          status: 'MATCHED',
        }),
        {
          hasChatRoom: false,
          marketplaceCount: 0,
          preferredAwaitingDecision: false,
          responseWindowExpired: false,
          selectableCount: 0,
          selectionLabel: 'Final partner selected',
          selectionPathLabel: 'Direct request confirmed by the first-pick partner',
          windowLabel: 'final partner selected',
        },
      ),
    ).toMatchObject({
      hasPreferredPartner: false,
      needsOps: true,
      status: 'MATCHED',
    });
  });
});
