import type { AdminBooking } from '../../lib/admin-api';
import { partnerDisplayText as operatorDisplayText } from '../../lib/admin-copy';
import { formatMoney } from '../../lib/admin-format';

export const ACTIVE_BOOKING_STATUSES = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

type BookingHandoffQueueOptions = {
  readonly nowMs?: number;
};

export function buildBookingHandoffQueue(
  bookings: readonly AdminBooking[],
  options: BookingHandoffQueueOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  return bookings
    .filter(
      (booking) =>
        ACTIVE_BOOKING_STATUSES.has(booking.status) ||
        recentlyChangedWithin(booking.updatedAt ?? booking.createdAt, nowMs),
    )
    .slice(0, 18)
    .map((booking) => {
      const selectedPartner = booking.selectedProvider ?? null;
      const preferredPartner = booking.preferredProvider ?? null;
      const participantCount = booking.participants?.length ?? 0;
      const walletAmount = booking.earning?.netAmount ?? 0;
      const chatReady = Boolean(booking.chatRoom?.id);
      return {
        id: booking.id,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        customerName: booking.customerProfile?.user?.fullName ?? 'Customer',
        customerPhone: booking.customerProfile?.user?.phone ?? '-',
        partnerName: operatorDisplayText(bookingPartnerName(booking)),
        partnerDetail: selectedPartner
          ? 'Selected Partner'
          : preferredPartner
            ? `Preferred Partner / ${participantCount} participant(s)`
            : `${participantCount} participant(s)`,
        status: booking.status,
        statusClass: bookingStatusClass(booking.status),
        paymentLabel: booking.payment
          ? `${booking.payment.method} / ${booking.payment.status} / ${formatMoney(
              booking.payment.amount,
              booking.payment.currency ?? 'VND',
            )}`
          : 'No payment row',
        walletLabel: booking.earning
          ? `Wallet effect ${formatMoney(walletAmount, booking.earning.currency)}`
          : 'No earning row yet',
        chatLabel: chatReady ? 'Chat archived' : 'Chat not created',
        chatClass: chatReady ? 'pill pill-success' : 'pill pill-warn',
        nextAction: bookingNextAction(booking),
      };
    });
}

export type BookingHandoffQueueRow = ReturnType<typeof buildBookingHandoffQueue>[number];

export function bookingPartnerName(booking: AdminBooking) {
  const participantLabel = participantNames(booking).join(', ');
  const directPartnerName = booking.selectedProvider?.displayName ?? booking.preferredProvider?.displayName;
  return directPartnerName || participantLabel || 'No Partner yet';
}

export function bookingStatusClass(status: string) {
  if (status === 'OPEN_MATCHING') return 'pill pill-warn';
  if (status === 'IN_SERVICE' || status === 'MATCHED') return 'pill pill-info';
  if (status === 'COMPLETED') return 'pill pill-success';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'pill pill-danger';
  return 'pill';
}

function participantNames(booking: AdminBooking) {
  return (booking.participants ?? [])
    .map((participant) =>
      operatorDisplayText(
        participant.providerProfile?.displayName ?? participant.providerProfile?.user?.fullName,
      ),
    )
    .filter(Boolean) as string[];
}

function bookingNextAction(booking: AdminBooking) {
  if (booking.status === 'OPEN_MATCHING') return 'Monitor Partner response window and customer choice list.';
  if (booking.status === 'MATCHED')
    return 'Confirm Partner starts service when ready; chat should be available.';
  if (booking.status === 'IN_SERVICE') return 'Keep chat visible until Partner completion.';
  if (booking.status === 'COMPLETED')
    return 'Check payment, earning, tax, wallet, and chat archive closeout.';
  if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED')
    return 'Check payment release, refund, and customer notice.';
  return 'Open booking detail for the latest factual state.';
}

function recentlyChangedWithin(value: string | null | undefined, nowMs: number, minutes = 120) {
  const timestamp = dateValue(value);
  if (!timestamp) return false;
  return nowMs - timestamp <= minutes * 60_000;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
