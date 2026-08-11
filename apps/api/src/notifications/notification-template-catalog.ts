import { Role } from '@prisma/client';

export const NOTIFICATION_TEMPLATE_LOCALES = ['en', 'vi', 'ko', 'ja', 'zh'] as const;

export type NotificationTemplateLocale = (typeof NOTIFICATION_TEMPLATE_LOCALES)[number];

export type DefaultNotificationTemplate = {
  readonly key: string;
  readonly audience: Extract<Role, 'CUSTOMER' | 'PROVIDER'>;
  readonly channel: 'BOTH' | 'IN_APP' | 'PUSH';
  readonly description: string;
  readonly variables: readonly string[];
  readonly title: string;
  readonly body: string;
};

export const DEFAULT_NOTIFICATION_TEMPLATES: readonly DefaultNotificationTemplate[] = [
  {
    key: 'booking.opened',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer confirmation after a booking request is created.',
    variables: ['partnerName', 'bookingId'],
    title: 'Booking opened',
    body: 'We are looking for nearby partners.',
  },
  {
    key: 'booking.requested',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Direct first-pick booking request sent to a Partner.',
    variables: ['bookingId'],
    title: 'New direct booking request',
    body: 'A customer requested one of your services.',
  },
  {
    key: 'booking.backup_available',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Marketplace/open request available to eligible nearby Partners.',
    variables: ['bookingId', 'distanceKm'],
    title: 'Nearby booking available',
    body: 'A nearby customer request is open for marketplace participation.',
  },
  {
    key: 'provider.joined',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when a Partner joins a booking request.',
    variables: ['partnerName', 'bookingId'],
    title: 'A partner joined',
    body: '{partnerName} joined your booking.',
  },
  {
    key: 'booking.matched',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when a Partner is matched and chat is ready.',
    variables: ['partnerName', 'bookingId', 'chatRoomId'],
    title: 'Partner matched',
    body: 'Your chat room is ready.',
  },
  {
    key: 'booking.matched.partner',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner notice after being selected or first-pick matched.',
    variables: ['bookingId'],
    title: 'You were matched',
    body: 'The customer selected you for this booking.',
  },
  {
    key: 'booking.rejected',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when a requested Partner cannot accept.',
    variables: ['bookingId', 'providerProfileId'],
    title: 'Partner declined your booking',
    body: 'We are still looking for another available partner.',
  },
  {
    key: 'provider.accepted',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice that a marketplace Partner is ready.',
    variables: ['partnerName', 'bookingId'],
    title: 'Marketplace partner is ready',
    body: '{partnerName} can take this booking. Select this partner if you want to switch.',
  },
  {
    key: 'provider.rejected',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice that a marketplace Partner declined.',
    variables: ['partnerName', 'bookingId'],
    title: 'Partner declined',
    body: '{partnerName} cannot take this booking.',
  },
  {
    key: 'service.started',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when the Partner starts service.',
    variables: ['bookingId', 'chatRoomId'],
    title: 'Service started',
    body: 'Your partner started the service. Continue in the matched chat if needed.',
  },
  {
    key: 'service.started.partner',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner notice when service starts.',
    variables: ['bookingId', 'chatRoomId'],
    title: 'Service started',
    body: 'Continue with the customer in the matched chat if needed.',
  },
  {
    key: 'service.completed',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice after service completion.',
    variables: ['bookingId'],
    title: 'Service completed',
    body: 'Please leave a review when you are ready.',
  },
  {
    key: 'earning.created',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner notice when completed work is added to earnings.',
    variables: ['bookingId'],
    title: 'Earning created',
    body: 'Your completed service has been added to earnings.',
  },
  {
    key: 'payment.updated',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice for payment status changes.',
    variables: ['bookingId', 'paymentId'],
    title: 'Payment updated',
    body: 'Your booking payment status was updated.',
  },
  {
    key: 'chat.message',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Chat message alert. Target role depends on sender and receiver.',
    variables: ['bookingId', 'chatRoomId'],
    title: 'New chat message',
    body: 'A new message is available in your booking chat.',
  },
  {
    key: 'booking.cancelled',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Booking cancellation notice.',
    variables: ['bookingId'],
    title: 'Booking cancelled',
    body: 'Your request has been cancelled.',
  },
  {
    key: 'booking.no_show',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'No-show admin review notice.',
    variables: ['bookingId'],
    title: 'No-show under review',
    body: 'HANDS operations marked this booking as no-show. Payment and support review is pending.',
  },
  {
    key: 'provider.account.blocked',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner account blocked notice.',
    variables: ['providerProfileId'],
    title: 'Partner account blocked',
    body: 'Your HANDS partner account is under admin review. Open the app for details.',
  },
  {
    key: 'provider.account.unblocked',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner account unblocked notice.',
    variables: ['providerProfileId'],
    title: 'Partner account unblocked',
    body: 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.',
  },
  {
    key: 'provider.payout_setup_required',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner payout setup notice after first earning.',
    variables: ['bookingId', 'providerProfileId'],
    title: 'Payout setup required',
    body: 'Your first HANDS earning is recorded. Add payout setup before requesting payout.',
  },
  {
    key: 'provider.payout_batch.updated',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner payout batch status update.',
    variables: ['payoutBatchId'],
    title: 'Payout batch updated',
    body: 'Your payout batch needs follow-up. Check the payout screen for details.',
  },
  {
    key: 'admin.push.broadcast',
    audience: Role.CUSTOMER,
    channel: 'PUSH',
    description: 'Manual admin push campaign. Audience is selected at send time.',
    variables: ['campaignId'],
    title: 'HANDS update',
    body: 'Open HANDS for the latest update.',
  },
];

export function isNotificationTemplateLocale(value: string): value is NotificationTemplateLocale {
  return (NOTIFICATION_TEMPLATE_LOCALES as readonly string[]).includes(value);
}
