export type BookingDetailWorkspace = 'overview' | 'records' | 'diagnostics';
export type BookingDetailDiagnosticsView = 'history' | 'settlement';
export type BookingDetailOverviewView = 'command' | 'activity';
export type BookingDetailCheckpoint =
  | 'CUSTOMER_CONTACTED'
  | 'PROVIDER_CONTACTED'
  | 'LOCATION_CHECKED'
  | 'PAYMENT_REVIEWED';

const BOOKING_DETAIL_CHECKPOINTS = new Set<BookingDetailCheckpoint>([
  'CUSTOMER_CONTACTED',
  'PROVIDER_CONTACTED',
  'LOCATION_CHECKED',
  'PAYMENT_REVIEWED',
]);

export function readBookingDetailWorkspace(
  params: Record<string, string | string[] | undefined>,
): BookingDetailWorkspace {
  const rawSection = Array.isArray(params.section) ? params.section[0] : params.section;
  if (rawSection === 'records') return 'records';
  if (rawSection === 'full' || rawSection === 'diagnostics') return 'diagnostics';
  return 'overview';
}

export function readBookingDetailDiagnosticsView(
  params: Record<string, string | string[] | undefined>,
): BookingDetailDiagnosticsView {
  const rawDiagnostics = Array.isArray(params.diagnostics) ? params.diagnostics[0] : params.diagnostics;
  return rawDiagnostics === 'settlement' ? 'settlement' : 'history';
}

export function readBookingDetailOverviewView(
  params: Record<string, string | string[] | undefined>,
): BookingDetailOverviewView {
  const rawOverview = Array.isArray(params.overview) ? params.overview[0] : params.overview;
  return rawOverview === 'activity' ? 'activity' : 'command';
}

export function readBookingDetailCheckpoint(
  params: Record<string, string | string[] | undefined>,
): BookingDetailCheckpoint | null {
  const rawCheckpoint = Array.isArray(params.checkpoint) ? params.checkpoint[0] : params.checkpoint;
  return BOOKING_DETAIL_CHECKPOINTS.has(rawCheckpoint as BookingDetailCheckpoint)
    ? (rawCheckpoint as BookingDetailCheckpoint)
    : null;
}

export function readBookingDetailReturnHref(
  params: Record<string, string | string[] | undefined>,
  fallback = '/bookings',
): string {
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  return rawReturnTo && /^\/(?:bookings|chat-archive|vietnam-overview)(?:[/?#]|$)/u.test(rawReturnTo) && !rawReturnTo.includes('\\')
    ? rawReturnTo
    : fallback;
}
