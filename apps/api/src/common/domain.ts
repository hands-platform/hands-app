export const SOCKET_ROOMS = {
  user: (userId: string) => `user:${userId}`,
  provider: (providerId: string) => `provider:${providerId}`,
  providers: () => 'providers:online',
  adminBookings: () => 'admin:bookings',
  booking: (bookingId: string) => `booking:${bookingId}`,
  chat: (chatRoomId: string) => `chat:${chatRoomId}`,
};

export const REALTIME_EVENTS = [
  'booking.created',
  'booking.opened',
  'provider.joined',
  'provider.accepted',
  'provider.rejected',
  'provider.arrived',
  'booking.matched',
  'booking.expired',
  'provider.location.updated',
  'chat.message.created',
  'service.started',
  'service.completed',
  'payment.updated',
] as const;
