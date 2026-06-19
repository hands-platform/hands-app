import { renderBookingMonitorRoute, type BookingMonitorRouteSearchParams } from '../booking-monitor-page';

type CompletedBookingsPageProps = {
  searchParams?: BookingMonitorRouteSearchParams;
};

export default async function CompletedBookingsPage({ searchParams }: CompletedBookingsPageProps) {
  return renderBookingMonitorRoute({ kind: 'completed', searchParams });
}
