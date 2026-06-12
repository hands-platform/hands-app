import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingListActionChips,
  bookingListActionChipsInput,
} from './booking-list-action-chip-inputs';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'CREATED',
    ...overrides,
  } as AdminBooking;
}

describe('booking list action chip inputs', () => {
  it('builds missing-payment facts for a new booking', () => {
    expect(bookingListActionChipsInput(booking(), nowMs)).toMatchObject({
      cashDebtNeedsOps: false,
      chatNeedsRepair: false,
      locationDetail: 'Partner location: not shared yet',
      locationNeedsOps: false,
      paymentDetail: 'No payment record is attached to this booking.',
      paymentNeedsOps: true,
    });
  });

  it('builds payment and chat facts for matched bookings', () => {
    expect(
      bookingListActionChipsInput(
        booking({
          status: 'MATCHED',
          chatRoom: {
            id: 'chat-1',
            messages: [{ id: 'message-1' }],
          } as AdminBooking['chatRoom'],
          payment: {
            amount: 150000,
            currency: 'VND',
            method: 'CARD',
            providerRef: 'provider-ref-1',
            status: 'AUTHORIZED',
          } as AdminBooking['payment'],
        }),
        nowMs,
      ),
    ).toMatchObject({
      chatNeedsRepair: false,
      chatState: {
        label: 'Chat ready',
        tone: 'pill-success',
      },
      paymentDetail: 'CARD / AUTHORIZED / 150.000 VND',
      paymentNeedsOps: false,
    });
  });

  it('keeps the list chip output wired to the extracted facts', () => {
    expect(bookingListActionChips(booking(), nowMs).map((chip) => chip.label)).toEqual([
      'Chat pending',
      'Location clear',
      'Payment check',
      'Cash clear',
      'Closeout clear',
      'Pricing check',
    ]);
  });
});
