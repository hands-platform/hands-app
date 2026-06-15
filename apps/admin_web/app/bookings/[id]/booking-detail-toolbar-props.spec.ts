import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingDetailToolbarProps } from './booking-detail-toolbar-props';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-toolbar-props',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

describe('booking detail toolbar props', () => {
  it('builds toolbar ids and service label from the loaded booking record', () => {
    const input = booking({
      chatRoom: { id: 'chat-room-1' } as AdminBookingDetail['chatRoom'],
      customerProfile: { id: 'customer-profile-1' } as AdminBookingDetail['customerProfile'],
      payment: { id: 'payment-1' } as AdminBookingDetail['payment'],
      refunds: [{ id: 'refund-1' }] as AdminBookingDetail['refunds'],
      selectedProvider: {
        id: 'partner-1',
        displayName: 'Linh Partner',
      } as AdminBookingDetail['selectedProvider'],
      services: [
        {
          service: {
            durationMin: 90,
            name: 'Aromatherapy',
          },
        },
      ] as AdminBookingDetail['services'],
    });

    expect(
      bookingDetailToolbarProps({
        booking: input,
        finalPartnerSummary: bookingFinalPartnerSummary(input),
      }),
    ).toEqual({
      bookingId: 'booking-toolbar-props',
      chatRoomId: 'chat-room-1',
      customerProfileId: 'customer-profile-1',
      finalPartnerId: 'partner-1',
      paymentId: 'payment-1',
      refundId: 'refund-1',
      serviceLabel: 'Aromatherapy / 90 min',
      status: 'MATCHED',
    });
  });
});
