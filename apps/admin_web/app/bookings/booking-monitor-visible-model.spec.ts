import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorVisibleModel } from './booking-monitor-visible-model';

function booking(
  id: string,
  input: {
    readonly customerName?: string;
    readonly paymentMethod?: string | null;
    readonly status?: string;
  } = {},
): AdminBooking {
  return {
    id,
    status: input.status ?? 'MATCHED',
    customerProfile: {
      user: {
        fullName: input.customerName,
      },
    },
    payment: input.paymentMethod ? { method: input.paymentMethod } : null,
  } as AdminBooking;
}

describe('buildBookingMonitorVisibleModel', () => {
  it('applies view, search, basic filters, and evidence filters in one place', () => {
    const model = buildBookingMonitorVisibleModel({
      blockedCreateCount: 0,
      bookings: [
        booking('kept', { customerName: 'Linh Nguyen', paymentMethod: 'CASH', status: 'MATCHED' }),
        booking('wrong-payment', {
          customerName: 'Linh Nguyen',
          paymentMethod: 'CARD',
          status: 'MATCHED',
        }),
        booking('wrong-search', { customerName: 'Minh Tran', paymentMethod: 'CASH', status: 'MATCHED' }),
        booking('wrong-view', { customerName: 'Linh Nguyen', paymentMethod: 'CASH', status: 'CANCELLED' }),
        booking('wrong-evidence', {
          customerName: 'Linh Nguyen',
          paymentMethod: 'CASH',
          status: 'MATCHED',
        }),
      ],
      evidenceFilter: 'chat',
      matchers: {
        matchesEvidenceFilter: (item) => item.id !== 'wrong-evidence',
        matchesView: (item, view) => view === 'active' && item.status === 'MATCHED',
      },
      paymentFilter: 'CASH',
      searchQuery: 'linh',
      statusFilter: 'MATCHED',
      view: 'active',
    });

    expect(model.visibleBookings.map((item) => item.id)).toEqual(['kept']);
    expect(model.baseVisibleBookingCount).toBe(4);
  });

  it('keeps blocked-create visible bookings empty and counts blocked attempts separately', () => {
    const model = buildBookingMonitorVisibleModel({
      blockedCreateCount: 3,
      bookings: [booking('active-one'), booking('active-two')],
      evidenceFilter: 'all',
      matchers: {
        matchesEvidenceFilter: () => true,
        matchesView: (_item, view) => view === 'active',
      },
      paymentFilter: 'all',
      searchQuery: '',
      statusFilter: 'all',
      view: 'blocked-create',
    });

    expect(model.visibleBookings).toEqual([]);
    expect(model.baseVisibleBookingCount).toBe(0);
    expect(model.bookingViewCounts.get('blocked-create')).toBe(3);
    expect(model.bookingViewCounts.get('active')).toBe(2);
  });
});
