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
});
