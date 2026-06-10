import { bookingRecordCreatedAt } from '../../../lib/admin-booking-time';
import { dateValue } from './partner-detail-format';

export type PartnerBookingArchiveRelation = 'Preferred' | 'Selected' | 'Joined';

export type PartnerBookingArchiveBooking = {
  readonly id: string;
  readonly createdAt?: string;
  readonly scheduledStartAt?: string;
  readonly updatedAt?: string;
  readonly chatRoom?: {
    readonly messages?: readonly {
      readonly body: string;
    }[];
  } | null;
};

export type PartnerBookingArchiveRecord<
  TBooking extends PartnerBookingArchiveBooking = PartnerBookingArchiveBooking,
> = {
  readonly relation: PartnerBookingArchiveRelation;
  readonly booking: TBooking;
  readonly lastMessage: string | null;
};

type PartnerBookingArchiveProvider<TBooking extends PartnerBookingArchiveBooking> = {
  readonly preferredBookings?: readonly TBooking[];
  readonly selectedBookings?: readonly TBooking[];
  readonly participants?: readonly {
    readonly booking?: TBooking | null;
    readonly id?: string;
    readonly status?: string;
  }[];
};

export function buildPartnerBookingArchive<TBooking extends PartnerBookingArchiveBooking>(
  provider: PartnerBookingArchiveProvider<TBooking>,
): PartnerBookingArchiveRecord<TBooking>[] {
  const records = new Map<string, PartnerBookingArchiveRecord<TBooking>>();

  for (const booking of provider.preferredBookings ?? []) {
    records.set(`${booking.id}:Preferred`, {
      relation: 'Preferred',
      booking,
      lastMessage: lastBookingMessage(booking),
    });
  }
  for (const booking of provider.selectedBookings ?? []) {
    records.set(`${booking.id}:Selected`, {
      relation: 'Selected',
      booking,
      lastMessage: lastBookingMessage(booking),
    });
  }
  for (const participant of provider.participants ?? []) {
    if (!participant.booking) continue;
    records.set(`${participant.booking.id}:Joined`, {
      relation: 'Joined',
      booking: participant.booking,
      lastMessage: lastBookingMessage(participant.booking),
    });
  }

  return [...records.values()].sort(
    (left, right) =>
      dateValue(bookingRecordCreatedAt(right.booking)) -
      dateValue(bookingRecordCreatedAt(left.booking)),
  );
}

function lastBookingMessage(booking: PartnerBookingArchiveBooking) {
  const message = booking.chatRoom?.messages?.[0];
  if (!message) return null;
  return trimText(message.body, 80);
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
