import { bookingRecordCreatedAt } from '../../../lib/admin-booking-time';
import { dateValue, formatDate, shortRecordId } from './partner-detail-format';

export type PartnerBookingArchiveRelation = 'Preferred' | 'Selected' | 'Joined';

export type PartnerBookingArchiveBooking = {
  readonly id: string;
  readonly createdAt?: string;
  readonly scheduledStartAt?: string;
  readonly status?: string;
  readonly updatedAt?: string;
  readonly customerProfile?: {
    readonly user?: { readonly phone?: string | null; readonly fullName?: string | null } | null;
  } | null;
  readonly services?: readonly {
    readonly id: string;
    readonly price?: number;
    readonly quantity?: number;
    readonly service?: { readonly name?: string; readonly durationMin?: number | null } | null;
  }[];
  readonly chatRoom?: {
    readonly id?: string;
    readonly messages?: readonly {
      readonly body: string;
      readonly createdAt?: string;
      readonly sender?: {
        readonly phone?: string | null;
        readonly fullName?: string | null;
        readonly roles?: readonly string[] | null;
      } | null;
    }[];
  } | null;
};
type PartnerBookingArchiveMessage = NonNullable<
  NonNullable<PartnerBookingArchiveBooking['chatRoom']>['messages']
>[number];

export type PartnerChatRetentionRow = {
  readonly adminRetention: string;
  readonly adminRetentionDetail: string;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly chatHref?: string;
  readonly hasRoom: boolean;
  readonly id: string;
  readonly latestMessage: string;
  readonly latestMessageAt?: string;
  readonly latestSender: string;
  readonly messageCount: number;
  readonly mobileHidden: boolean;
  readonly mobileVisibility: string;
  readonly mobileVisibilityDetail: string;
  readonly relation: string;
  readonly requiresRoom: boolean;
  readonly roleDetail: string;
  readonly roomDetail: string;
  readonly roomStatus: string;
  readonly serviceLabel: string;
  readonly status: string;
};

export type PartnerChatRetentionSummaryItem = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
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

export function buildPartnerChatRetentionRows<TBooking extends PartnerBookingArchiveBooking>(
  records: readonly PartnerBookingArchiveRecord<TBooking>[],
): PartnerChatRetentionRow[] {
  return records.slice(0, 40).map((record) => {
    const booking = record.booking;
    const messages = readPartnerChatMessages(booking);
    const latestMessage = messages[messages.length - 1];
    const requiresRoom = partnerBookingRequiresRetainedChat(booking);
    const mobileHidden = partnerBookingChatHiddenInMobile(booking);
    const latestSender = latestMessage ? chatSenderLabel(latestMessage) : 'No message';

    return {
      id: booking.id,
      relation: record.relation,
      bookingLabel: `${shortRecordId(booking.id)} / ${formatDate(bookingRecordCreatedAt(booking))}`,
      serviceLabel: `${bookingServiceLabel(booking)} / customer ${partnerBookingCustomer(booking)}`,
      status: booking.status ?? 'UNKNOWN',
      roleDetail: partnerRoleRetentionDetail(record),
      roomStatus: booking.chatRoom
        ? `${messages.length} retained message(s)`
        : requiresRoom
          ? 'Matched booking without room'
          : 'No room required yet',
      roomDetail: booking.chatRoom
        ? `Room ${shortRecordId(booking.chatRoom.id ?? booking.id)} / ${partnerBookingChatEvidenceLabel(
            booking,
          )}`
        : requiresRoom
          ? 'Matched or service-stage booking should have a retained chat room.'
          : 'Pre-match bookings do not open customer-partner chat yet.',
      latestSender,
      latestMessage: latestMessage ? trimText(latestMessage.body, 120) : 'No retained message loaded',
      latestMessageAt: latestMessage?.createdAt,
      mobileVisibility: mobileHidden
        ? 'Hidden in mobile after closeout'
        : booking.chatRoom
          ? 'Visible while service is active'
          : 'Not visible yet',
      mobileVisibilityDetail: mobileHidden
        ? 'Customer and partner apps may hide completed or closed chats, but admin keeps the archive.'
        : booking.chatRoom
          ? 'Room should remain visible until the service is completed or closed.'
          : 'Chat opens after customer final partner selection.',
      adminRetention: booking.chatRoom
        ? 'Admin archive retained'
        : requiresRoom
          ? 'Admin repair needed'
          : 'Waiting for match',
      adminRetentionDetail: booking.chatRoom
        ? 'Use the archive link for full message evidence.'
        : requiresRoom
          ? 'Open the booking detail to repair or investigate the missing room.'
          : 'No customer-partner chat evidence is expected before matching.',
      bookingHref: `/bookings/${booking.id}`,
      chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      hasRoom: Boolean(booking.chatRoom),
      requiresRoom,
      messageCount: messages.length,
      mobileHidden,
    };
  });
}

export function buildPartnerChatRetentionSummary(
  rows: readonly PartnerChatRetentionRow[],
): PartnerChatRetentionSummaryItem[] {
  const retainedRooms = rows.filter((row) => row.hasRoom).length;
  const retainedMessages = rows.reduce((sum, row) => sum + row.messageCount, 0);
  const matchedWithoutRoom = rows.filter((row) => row.requiresRoom && !row.hasRoom).length;
  const mobileHidden = rows.filter((row) => row.mobileHidden && row.hasRoom).length;

  return [
    {
      label: 'Retained rooms',
      value: retainedRooms.toString(),
      helper: 'Partner chat rooms saved for admin evidence.',
    },
    {
      label: 'Retained messages',
      value: retainedMessages.toString(),
      helper: 'Loaded messages across this partner date filter.',
    },
    {
      label: 'Matched without room',
      value: matchedWithoutRoom.toString(),
      helper: 'Matched/service-stage bookings that need chat-room repair.',
    },
    {
      label: 'Hidden in mobile',
      value: mobileHidden.toString(),
      helper: 'Completed or closed chats still retained by admin.',
    },
  ];
}

function lastBookingMessage(booking: PartnerBookingArchiveBooking) {
  const message = booking.chatRoom?.messages?.[0];
  if (!message) return null;
  return trimText(message.body, 80);
}

function readPartnerChatMessages(booking: PartnerBookingArchiveBooking) {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  });
}

function partnerRoleRetentionDetail(record: PartnerBookingArchiveRecord) {
  if (record.relation === 'Selected') {
    return 'Customer selected this partner for final service handoff.';
  }
  if (record.relation === 'Preferred') {
    return 'Customer first picked this partner before marketplace participation.';
  }
  return 'Partner participated in the marketplace shortlist for customer final choice.';
}

function partnerBookingRequiresRetainedChat(booking: PartnerBookingArchiveBooking) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status ?? '',
  );
}

function partnerBookingChatHiddenInMobile(booking: PartnerBookingArchiveBooking) {
  return ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(booking.status ?? '');
}

export function chatSenderLabel(message: PartnerBookingArchiveMessage) {
  const role = message.sender?.roles?.includes('CUSTOMER')
    ? 'Customer'
    : message.sender?.roles?.includes('PROVIDER')
      ? 'Partner'
      : message.sender?.roles?.includes('ADMIN')
        ? 'Admin'
        : 'Sender';
  return `${role}: ${message.sender?.fullName ?? message.sender?.phone ?? 'Unknown'}`;
}

function bookingServiceLabel(booking: PartnerBookingArchiveBooking) {
  const labels = (booking.services ?? [])
    .map((item) => {
      const name = item.service?.name ?? 'Service';
      const duration = item.service?.durationMin ? ` ${item.service.durationMin}m` : '';
      return `${name}${duration}`;
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : 'No service';
}

function partnerBookingCustomer(booking: PartnerBookingArchiveBooking) {
  return (
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Unknown customer'
  );
}

function partnerBookingChatEvidenceLabel(booking: PartnerBookingArchiveBooking) {
  const status = booking.status ?? '';
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(status)) {
    return 'Matched booking needs retained chat archive';
  }
  return 'No matched chat yet';
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
