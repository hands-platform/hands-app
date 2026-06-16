import { adminCustomerDetailBookingSelect } from './admin-booking-selects';
import { adminCustomerDetailSelect, adminCustomerNotificationSelect } from './admin-customer-selects';

describe('admin customer selects', () => {
  it('keeps customer notifications bounded with delivery context', () => {
    expect(adminCustomerNotificationSelect.deliveries).toMatchObject({
      orderBy: { attemptedAt: 'desc' },
      take: 5,
      select: expect.objectContaining({ status: true, attemptedAt: true }),
    });
  });

  it('keeps customer detail activity lists bounded', () => {
    expect(adminCustomerDetailSelect.user.select.appSessions).toMatchObject({ take: 20 });
    expect(adminCustomerDetailSelect.user.select.appSessions.select).toMatchObject({
      deviceLanguage: true,
      lastLoginAddress: true,
    });
    expect(adminCustomerDetailSelect.user.select.notifications).toMatchObject({
      take: 50,
      select: adminCustomerNotificationSelect,
    });
    expect(adminCustomerDetailSelect.selectedLocations).toMatchObject({ take: 25 });
    expect(adminCustomerDetailSelect.bookings).toMatchObject({
      take: 100,
      select: adminCustomerDetailBookingSelect,
    });
    expect(adminCustomerDetailSelect.reviews).toMatchObject({ take: 25 });
  });
});
