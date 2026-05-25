import { AdminBooking, adminGet } from '../../lib/admin-api';
import { BookingMonitor } from './booking-monitor';

type BookingsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingsPage({ searchParams }: { searchParams?: BookingsPageSearchParams }) {
  const bookings = await adminGet<AdminBooking[]>('/admin/bookings', []);
  const initialView = readBookingView((await searchParams)?.view);

  return <BookingMonitor bookings={bookings} initialView={initialView} />;
}

function readBookingView(value: string | string[] | undefined) {
  const view = Array.isArray(value) ? value[0] : value;
  if (
    view === 'high-risk' ||
    view === 'payment' ||
    view === 'location' ||
    view === 'chat' ||
    view === 'all'
  ) {
    return view;
  }
  return 'active';
}
