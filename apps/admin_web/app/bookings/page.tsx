import { renderBookingMonitorRoute, type BookingMonitorRouteSearchParams } from './booking-monitor-page';

type BookingsPageProps = {
  searchParams?: BookingMonitorRouteSearchParams;
};

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  return renderBookingMonitorRoute({ kind: 'all', searchParams });
}
