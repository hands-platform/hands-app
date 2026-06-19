import { renderBookingMonitorRoute, type BookingMonitorRouteSearchParams } from '../booking-monitor-page';

type PostMatchCancellationsPageProps = {
  searchParams?: BookingMonitorRouteSearchParams;
};

export default async function PostMatchCancellationsPage({
  searchParams,
}: PostMatchCancellationsPageProps) {
  return renderBookingMonitorRoute({ kind: 'postMatchCancellations', searchParams });
}
