import { AdminBooking, adminGet } from '../../lib/admin-api';
import { BookingMonitor } from './booking-monitor';

type BookingsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingsPage({ searchParams }: { searchParams?: BookingsPageSearchParams }) {
  const bookings = await adminGet<AdminBooking[]>('/admin/bookings', []);
  const params = await searchParams;
  const initialView = readBookingView(params?.view, params?.status);

  return <BookingMonitor bookings={bookings} initialView={initialView} />;
}

function readBookingView(value: string | string[] | undefined, statusValue?: string | string[] | undefined) {
  const view = Array.isArray(value) ? value[0] : value;
  const status = Array.isArray(statusValue) ? statusValue[0] : statusValue;
  if (
    view === 'high-risk' ||
    view === 'no-supply' ||
    view === 'payment' ||
    view === 'cash-debt' ||
    view === 'closeout' ||
    view === 'pricing' ||
    view === 'location' ||
    view === 'chat' ||
    view === 'expired' ||
    view === 'no-show' ||
    view === 'all'
  ) {
    return view;
  }
  if (status === 'EXPIRED') {
    return 'expired';
  }
  if (status === 'NO_SHOW') {
    return 'no-show';
  }
  return 'active';
}
