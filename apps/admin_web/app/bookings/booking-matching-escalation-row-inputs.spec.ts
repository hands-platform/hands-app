import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMatchingEscalationRowInput,
  bookingMatchingEscalationRowInputFromBooking,
} from './booking-matching-escalation-row-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

const nowMs = new Date('2026-06-12T09:45:00.000Z').getTime();

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
        selectionLabel: 'First-pick Partner pending',
        selectionPathLabel: 'Direct request first, with marketplace Partners already waiting',
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
      selectionLabel: 'First-pick Partner pending',
      selectionPathLabel: 'Direct request first, with marketplace Partners already waiting',
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
          selectionLabel: 'Final Partner selected',
          selectionPathLabel: 'Direct request confirmed by the first-pick Partner',
          windowLabel: 'final Partner selected',
        },
      ),
    ).toMatchObject({
      hasPreferredPartner: false,
      needsOps: true,
      status: 'MATCHED',
    });
  });

  it('builds row input from booking timing and chat facts', () => {
    expect(
      bookingMatchingEscalationRowInputFromBooking(
        booking({
          createdAt: '2026-06-12T09:40:00.000Z',
          expiresAt: '2026-06-12T09:35:00.000Z',
          id: 'booking-3',
          status: 'OPEN_MATCHING',
        }),
        nowMs,
        {
          marketplaceCount: 0,
          preferredAwaitingDecision: false,
          selectableCount: 0,
          selectionLabel: 'No first-pick Partner',
          selectionPathLabel: 'Open pool request',
        },
      ),
    ).toMatchObject({
      hasChatRoom: false,
      needsOps: true,
      responseWindowExpired: true,
      status: 'OPEN_MATCHING',
      windowLabel: '10m overdue',
    });
  });
});
