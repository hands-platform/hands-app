import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingCustomerWaitPanel } from './booking-customer-wait-panel';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-wait-panel',
    status: 'OPEN_MATCHING',
    participants: [],
    ...input,
  } as AdminBookingDetail;
}

describe('booking customer wait panel', () => {
  it('does not treat matched status alone as a customer final partner choice', () => {
    const panel = bookingCustomerWaitPanel(
      booking({
        status: 'MATCHED',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Pick Partner',
        },
      }),
      {
        eligibleCount: 0,
        decisionDetail: 'No eligible marketplace partners.',
      },
      [],
    );

    const customerChoiceCard = panel.cards.find((card) => card.title === 'Customer final choice');
    const chatCard = panel.cards.find((card) => card.title === 'Chat handoff');

    expect(customerChoiceCard).toMatchObject({
      status: 'Waiting',
      detail: 'No participating/accepted partner is ready for final customer selection yet.',
    });
    expect(chatCard).toMatchObject({
      status: 'Locked',
      detail: 'Chat stays locked until first-pick match or customer final selection is recorded.',
    });
  });

  it('uses API matching evidence to mark chat handoff ready', () => {
    const panel = bookingCustomerWaitPanel(
      booking({
        status: 'MATCHED',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Pick Partner',
        },
        participants: [
          {
            id: 'participant-first',
            status: 'ACCEPTED',
            providerProfile: {
              id: 'partner-first',
              displayName: 'First Pick Partner',
            },
          },
        ],
        matchingEvidence: {
          stage: 'MATCHED',
          firstPickStatus: 'ACCEPTED',
          finalSelection: 'FIRST_PICK_ACCEPTED',
          marketplaceParticipantCount: 1,
          selectableParticipantCount: 0,
          matchedAt: '2026-06-10T09:00:00.000Z',
          matchSource: 'FIRST_PICK_ACCEPTED',
          chatReady: true,
        },
        chatRoom: null,
      }),
      {
        eligibleCount: 0,
        decisionDetail: 'No eligible marketplace partners.',
      },
      [],
    );

    const chatCard = panel.cards.find((card) => card.title === 'Chat handoff');

    expect(chatCard).toMatchObject({
      status: 'Ready',
      detail: 'API evidence reports chat is ready, but room details are not loaded in this response.',
    });
  });
});
