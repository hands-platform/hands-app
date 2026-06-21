import {
  auditLogNoteText,
  bookingServiceLabel,
  bookingTotal,
  isClosedPartnerBooking,
  partnerBookingAddressEvidenceLabel,
  readPartnerChatMessages,
  trimText,
  type PartnerDetailBooking,
} from './partner-detail-record-helpers';

describe('partner detail record helpers', () => {
  it('formats booking service labels and totals', () => {
    const booking: PartnerDetailBooking = {
      id: 'booking_1',
      services: [
        { id: 'svc_1', price: 150_000, quantity: 2, service: { name: 'Massage', durationMin: 60 } },
        { id: 'svc_2', price: 90_000, quantity: 1, service: { name: 'Foot care', durationMin: null } },
      ],
    };

    expect(bookingServiceLabel(booking)).toBe('Massage 60m, Foot care');
    expect(bookingTotal(booking)).toBe(390_000);
  });

  it('prefers address snapshot text for booking address evidence', () => {
    expect(
      partnerBookingAddressEvidenceLabel({
        id: 'booking_1',
        addressSnapshot: {
          addressText: 'Cau Giay, Ha Noi',
          latitude: '21.03',
          longitude: '105.79',
        },
      }),
    ).toBe('Cau Giay, Ha Noi / snapshot 21.03, 105.79');
  });

  it('sorts retained chat messages by creation time', () => {
    const messages = readPartnerChatMessages({
      id: 'booking_1',
      chatRoom: {
        id: 'chat_1',
        messages: [
          { id: 'msg_2', body: 'second', createdAt: '2026-06-13T03:15:00.000Z' },
          { id: 'msg_1', body: 'first', createdAt: '2026-06-13T03:10:00.000Z' },
        ],
      },
    });

    expect(messages.map((message) => message.id)).toEqual(['msg_1', 'msg_2']);
  });

  it('keeps closed booking and audit note behavior stable', () => {
    expect(isClosedPartnerBooking({ id: 'booking_1', status: 'NO_SHOW' })).toBe(true);
    expect(isClosedPartnerBooking({ id: 'booking_2', status: 'IN_SERVICE' })).toBe(false);
    expect(trimText('1234567890', 7)).toBe('1234...');
    expect(
      auditLogNoteText({
        id: 'audit_1',
        action: 'PARTNER_NOTE',
        target: 'Partner',
        metadata: { note: 'Operator note' },
        createdAt: '2026-06-13T03:10:00.000Z',
      }),
    ).toBe('Operator note');
  });
});
