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
  it('does not treat matched status alone as a customer final Partner choice', () => {
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
        decisionDetail: 'No eligible marketplace Partners.',
      },
      [],
    );

    const customerChoiceCard = panel.cards.find((card) => card.title === 'Customer final choice');
    const chatCard = panel.cards.find((card) => card.title === 'Chat handoff');

    expect(customerChoiceCard).toMatchObject({
      status: 'Waiting',
      detail: 'No participating/accepted Partner is ready for final customer selection yet.',
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
          matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
          chatReady: true,
        },
        chatRoom: null,
      }),
      {
        eligibleCount: 0,
        decisionDetail: 'No eligible marketplace Partners.',
      },
      [],
    );

    const chatCard = panel.cards.find((card) => card.title === 'Chat handoff');

    expect(chatCard).toMatchObject({
      status: 'Ready',
      detail: 'API evidence reports chat is ready, but room details are not loaded in this response.',
    });
  });

  it('uses operator-facing saved policy wording when marketplace participation is held', () => {
    const panel = bookingCustomerWaitPanel(
      booking({
        expiresAt: '2099-06-10T09:00:00.000Z',
        metadata: {
          matchingPolicy: {
            backupOpenMode: 'AFTER_FIRST_PICK_DELAY',
            preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
            providerResponseWindowMinutes: 10,
          },
        },
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Pick Partner',
        },
      }),
      {
        eligibleCount: 2,
        decisionDetail: '2 eligible marketplace Partners.',
      },
      [],
    );

    const marketplaceCard = panel.cards.find((card) => card.title === 'Marketplace participation');

    expect(marketplaceCard).toMatchObject({
      action: 'Saved policy holds marketplace visibility while first-pick is deciding.',
      detail: 'Marketplace participation is not currently open for this saved policy.',
      status: 'Waiting',
    });
    expect(JSON.stringify(marketplaceCard)).not.toMatch(/snapshot/i);
  });
});
