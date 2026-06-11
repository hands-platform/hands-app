import { BookingStatus, PaymentStatus } from '@prisma/client';
import {
  bookingCompletedUpdateData,
  bookingServiceStartedUpdateData,
} from './bookings.lifecycle';

describe('booking lifecycle update helpers', () => {
  it('builds the service-started update data with chat handoff ready', () => {
    expect(bookingServiceStartedUpdateData()).toEqual({
      status: BookingStatus.IN_SERVICE,
      chatRoom: { upsert: { create: {}, update: {} } },
    });
  });

  it('builds the completed booking update data with captured payment', () => {
    expect(bookingCompletedUpdateData()).toEqual({
      status: BookingStatus.COMPLETED,
      payment: { update: { status: PaymentStatus.CAPTURED } },
    });
  });
});
