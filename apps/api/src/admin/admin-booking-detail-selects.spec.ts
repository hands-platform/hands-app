import { adminBookingDetailSelect, adminPaymentDetailSelect } from './admin-booking-detail-selects';
import { adminBookingDetailProviderSelect } from './admin-provider-profile-selects';

describe('admin booking detail selects', () => {
  it('keeps booking detail connected to customer, provider, payment, and ops context', () => {
    expect(adminBookingDetailSelect).toMatchObject({
      customerProfile: expect.any(Object),
      preferredProvider: { select: adminBookingDetailProviderSelect },
      selectedProvider: { select: adminBookingDetailProviderSelect },
      payment: expect.any(Object),
      opsTasks: expect.any(Object),
      snapshots: { take: 10 },
    });
  });

  it('keeps booking detail chat transcript bounded', () => {
    expect(adminBookingDetailSelect.chatRoom.select.messages).toMatchObject({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('keeps payment detail attached to booking detail and refunds', () => {
    expect(adminPaymentDetailSelect.booking).toMatchObject({
      select: adminBookingDetailSelect,
    });
    expect(adminPaymentDetailSelect.refunds).toMatchObject({
      orderBy: { createdAt: 'desc' },
    });
  });
});
