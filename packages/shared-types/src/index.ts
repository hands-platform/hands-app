export type Role = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

export type BookingStatus =
  | 'CREATED'
  | 'OPEN_MATCHING'
  | 'MATCHED'
  | 'PROVIDER_ON_THE_WAY'
  | 'ARRIVED'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED'
  | 'REFUNDED';

export type ProviderStatus = 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'ONLINE_AVAILABLE_SOON';

export const REALTIME_EVENTS = [
  'booking.created',
  'booking.opened',
  'booking.requested',
  'booking.backup_available',
  'provider.joined',
  'provider.accepted',
  'provider.rejected',
  'booking.matched',
  'booking.cancelled',
  'booking.rejected',
  'booking.expired',
  'booking.no_show',
  'provider.account.blocked',
  'provider.account.unblocked',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
  'provider.location.updated',
  'chat.message.created',
  'service.started',
  'service.completed',
  'earning.created',
  'payment.updated',
] as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];

export const PARTNER_ALERT_EVENTS = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
] as const satisfies readonly RealtimeEvent[];

export type PartnerAlertEvent = (typeof PARTNER_ALERT_EVENTS)[number];
