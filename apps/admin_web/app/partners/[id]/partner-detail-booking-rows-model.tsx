import type { AdminChatWindowMessageRole } from '../../../components/admin-chat-window';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import {
  bookingRecordCreatedAt,
  bookingRequestOpenedAt,
} from '../../../lib/admin-booking-time';
import {
  type PartnerBookingArchiveRecord as PartnerBookingArchiveModelRecord,
  chatSenderLabel,
} from './partner-detail-booking-model';
import type { PartnerBookingChatRecordRow } from './partner-detail-booking-chat-records-section';
import type { PartnerBookingEvidenceRow } from './partner-detail-booking-evidence-bundles-section';
import type { PartnerBookingJourneyRow } from './partner-detail-booking-journey-section';
import {
  formatCurrency,
  formatDate,
  formatDistance,
  locationAgeLabel,
  newestDateValue,
  shortRecordId,
} from './partner-detail-format';
import {
  bookingClosureLabel,
  bookingServiceLabel,
  bookingTotal,
  isClosedPartnerBooking,
  partnerBookingAddressEvidenceLabel,
  partnerBookingChatEvidenceLabel,
  partnerBookingCustomer,
  readPartnerChatMessages,
  type PartnerDetailBooking,
} from './partner-detail-record-helpers';
import type {
  PartnerDispatchPolicy,
  PartnerEarning,
  PartnerEarningsByBookingId,
  ProviderDetail,
} from './partner-detail-types';

type PartnerBookingArchiveRecord = PartnerBookingArchiveModelRecord<PartnerDetailBooking>;

export function buildPartnerBookingChatRecordRows(
  records: PartnerBookingArchiveRecord[],
): PartnerBookingChatRecordRow[] {
  return records.slice(0, 10).map((record) => {
    const booking = record.booking;
    const messages = readPartnerChatMessages(booking);
    const paymentAmount = Number(booking.payment?.amount ?? 0);
    const paymentCurrency = booking.payment?.currency ?? 'VND';
    const paymentMethod = booking.payment?.method ?? 'UNKNOWN';
    const participantCount = booking.participants?.length ?? 0;
    const lastMessage = record.lastMessage ? ` / last: ${record.lastMessage}` : '';

    return {
      bookingHref: `/bookings/${booking.id}`,
      chatHref: booking.chatRoom?.id ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      chatLine: `Chat ${booking.chatRoom?.id ?? 'not created'} / messages ${
        booking.chatRoom?.messages?.length ?? 0
      }${lastMessage}`,
      chatMessages: messages.map((message) => ({
        body: message.body,
        createdDateTime: message.createdAt,
        id: message.id,
        role: partnerChatMessageRole(message),
        senderLabel: chatSenderLabel(message),
      })),
      closureLine: isClosedPartnerBooking(booking)
        ? `Closed ${formatDate(booking.closedAt)} / ${bookingClosureLabel(booking)}`
        : undefined,
      closureLineNode: isClosedPartnerBooking(booking) ? (
        <>
          Closed <DateTimeText fallback="Missing" value={booking.closedAt} /> / {bookingClosureLabel(booking)}
        </>
      ) : undefined,
      customerHref: booking.customerProfileId ? `/customers/${booking.customerProfileId}` : undefined,
      customerLine: `Customer ${partnerBookingCustomer(booking)} / requested ${formatDate(
        bookingRequestOpenedAt(booking),
      )}`,
      customerLineNode: (
        <>
          Customer {partnerBookingCustomer(booking)} / requested{' '}
          <DateTimeText fallback="Missing" value={bookingRequestOpenedAt(booking)} />
        </>
      ),
      hasChatRoom: Boolean(booking.chatRoom),
      heading: `${bookingServiceLabel(booking)} / ${booking.status ?? 'UNKNOWN'}`,
      key: `${booking.id}-${record.relation}`,
      paymentLine: `Payment ${paymentMethod} / ${formatCurrency(paymentAmount, paymentCurrency)} / participants ${participantCount}`,
      paymentLineNode: (
        <>
          Payment {paymentMethod} / <MoneyText amount={paymentAmount} currency={paymentCurrency} /> /
          participants {participantCount}
        </>
      ),
      relation: record.relation,
    };
  });
}

export function buildPartnerEarningsByBookingId(
  earnings: readonly PartnerEarning[],
): PartnerEarningsByBookingId {
  const earningsByBookingId = new Map<string, PartnerEarning>();

  for (const earning of earnings) {
    if (earning.bookingId) {
      earningsByBookingId.set(earning.bookingId, earning);
    }
  }

  return earningsByBookingId;
}

export function buildPartnerBookingEvidenceRows(
  provider: ProviderDetail,
  bookingArchive: PartnerBookingArchiveRecord[],
  earningsByBookingId: PartnerEarningsByBookingId,
): PartnerBookingEvidenceRow[] {
  return bookingArchive.slice(0, 30).map((record) => {
    const booking = record.booking;
    const chatMessages = readPartnerChatMessages(booking);
    const participant = (booking.participants ?? []).find((item) => item.providerProfileId === provider.id);
    const earning = earningsByBookingId.get(booking.id);
    const walletRows = earning?.walletLedgerEntries ?? [];
    const paymentAmount = Number(booking.payment?.amount ?? 0);
    const paymentCurrency = booking.payment?.currency ?? 'VND';
    const earningNetAmount = Number(earning?.netAmount ?? 0);
    const earningCurrency = earning?.currency ?? 'VND';
    const latestLocation = provider.currentLocationUpdatedAt
      ? `${locationAgeLabel(provider.currentLocationUpdatedAt)} / ${partnerLocationSavedLabel()}`
      : 'No latest location loaded';
    const addressDetail = partnerBookingAddressEvidenceLabel(booking);
    const moneyParts = [
      booking.payment
        ? `${booking.payment.status ?? 'UNKNOWN'} ${booking.payment.method ?? 'UNKNOWN'} ${formatCurrency(
            booking.payment.amount ?? 0,
            booking.payment.currency ?? 'VND',
          )}`
        : 'No payment row',
      earning
        ? `earning ${earning.status} net ${formatCurrency(earning.netAmount, earning.currency ?? 'VND')}`
        : 'no earning row',
      walletRows.length ? `${walletRows.length} wallet row(s)` : 'no wallet rows',
    ];
    const opsParts = [
      `participant ${participant?.status ?? 'not linked'}`,
      participant?.joinedAt
        ? `participated ${formatDate(participant.joinedAt)}`
        : 'participation time not stored',
      participant?.respondedAt
        ? `responded ${formatDate(participant.respondedAt)}`
        : 'response time not stored',
      `${booking.opsTasks?.length ?? 0} staff task(s)`,
      `location ${latestLocation}`,
    ];

    return {
      id: booking.id,
      relation: record.relation,
      bookingLabel: `${shortRecordId(booking.id)} / ${formatDate(bookingRecordCreatedAt(booking))}`,
      bookingLabelNode: (
        <>
          {shortRecordId(booking.id)} /{' '}
          <DateTimeText fallback="Missing" value={bookingRecordCreatedAt(booking)} />
        </>
      ),
      serviceLabel: `${bookingServiceLabel(booking)} / ${formatCurrency(bookingTotal(booking))}`,
      serviceLabelNode: (
        <>
          {bookingServiceLabel(booking)} /{' '}
          <MoneyText amount={bookingTotal(booking)} currency={paymentCurrency} />
        </>
      ),
      status: booking.status ?? 'UNKNOWN',
      roleStatus:
        record.relation === 'Selected'
          ? 'Final partner'
          : record.relation === 'Preferred'
            ? 'First-pick partner'
            : 'Marketplace participant',
      roleDetail: `${record.relation} / ${participant?.status ?? 'booking relation'} / ${
        booking.participants?.length ?? 0
      } participant(s)`,
      customerStatus: partnerBookingCustomer(booking),
      customerDetail: addressDetail,
      customerHref: booking.customerProfileId ? `/customers/${booking.customerProfileId}` : undefined,
      chatStatus: booking.chatRoom ? `${chatMessages.length} message(s)` : 'No chat room',
      chatDetail: booking.chatRoom
        ? `Room ${shortRecordId(booking.chatRoom.id)}${record.lastMessage ? ` / last ${record.lastMessage}` : ''}`
        : partnerBookingChatEvidenceLabel(booking),
      chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      moneyStatus: earning?.status ?? booking.payment?.status ?? 'No earning',
      moneyDetail: moneyParts.join(' / '),
      moneyDetailNode: (
        <>
          {booking.payment ? (
            <>
              {booking.payment.status ?? 'UNKNOWN'} {booking.payment.method ?? 'UNKNOWN'}{' '}
              <MoneyText amount={paymentAmount} currency={paymentCurrency} />
            </>
          ) : (
            'No payment row'
          )}
          {' / '}
          {earning ? (
            <>
              earning {earning.status} net{' '}
              <MoneyText amount={earningNetAmount} currency={earningCurrency} />
            </>
          ) : (
            'no earning row'
          )}
          {' / '}
          {walletRows.length ? `${walletRows.length} wallet row(s)` : 'no wallet rows'}
        </>
      ),
      opsStatus:
        isClosedPartnerBooking(booking) || participant?.respondedAt || earning
          ? 'Records linked'
          : 'Minimal records',
      opsDetail: opsParts.join(' / '),
      opsDetailNode: (
        <>
          participant {participant?.status ?? 'not linked'} /{' '}
          {participant?.joinedAt ? (
            <>
              participated <DateTimeText fallback="Missing" value={participant.joinedAt} />
            </>
          ) : (
            'participation time not stored'
          )}
          {' / '}
          {participant?.respondedAt ? (
            <>
              responded <DateTimeText fallback="Missing" value={participant.respondedAt} />
            </>
          ) : (
            'response time not stored'
          )}
          {' / '}
          {booking.opsTasks?.length ?? 0} staff task(s) / location {latestLocation}
        </>
      ),
    };
  });
}

export function buildPartnerBookingJourneyRows(
  provider: ProviderDetail,
  bookingArchive: PartnerBookingArchiveRecord[],
  dispatchPolicy: PartnerDispatchPolicy,
  earningsByBookingId: PartnerEarningsByBookingId,
): PartnerBookingJourneyRow[] {
  return bookingArchive.slice(0, 20).map((record) => {
    const booking = record.booking;
    const participant = (booking.participants ?? []).find((item) => item.providerProfileId === provider.id);
    const chatMessages = readPartnerChatMessages(booking);
    const latestMessage = chatMessages[chatMessages.length - 1];
    const earning = earningsByBookingId.get(booking.id);
    const walletRows = earning?.walletLedgerEntries ?? [];
    const isFinalPartner = record.relation === 'Selected';
    const hasChat = Boolean(booking.chatRoom);
    const shouldHaveChat = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
      booking.status ?? '',
    );
    const firstPickValue =
      record.relation === 'Preferred'
        ? `${dispatchPolicy.responseWindowMinutes} min first-pick`
        : isFinalPartner
          ? 'Customer selected'
          : 'Marketplace participation';
    const marketplaceValue =
      record.relation === 'Joined'
        ? `Within ${formatDistance(dispatchPolicy.backupRadiusMeters)} policy`
        : `${booking.participants?.length ?? 0} participant(s)`;
    const moneyValue = earning
      ? `earning ${earning.status}`
      : booking.payment
        ? `${booking.payment.status ?? 'UNKNOWN'} ${booking.payment.method ?? 'UNKNOWN'}`
        : 'No money row';
    const latestAt = newestDateValue([
      latestMessage?.createdAt,
      participant?.respondedAt,
      participant?.joinedAt,
      booking.closedAt,
      earning?.paidAt,
      earning?.availableAt,
      earning?.createdAt,
      bookingRecordCreatedAt(booking),
    ]);

    return {
      id: booking.id,
      relation: record.relation,
      heading: `${bookingServiceLabel(booking)} / ${shortRecordId(booking.id)} / ${
        booking.status ?? 'UNKNOWN'
      }`,
      detail: `${formatCurrency(bookingTotal(booking))} / ${partnerBookingAddressEvidenceLabel(
        booking,
      )} / customer ${partnerBookingCustomer(booking)}`,
      detailNode: (
        <>
          <MoneyText amount={bookingTotal(booking)} currency={booking.payment?.currency ?? 'VND'} /> /{' '}
          {partnerBookingAddressEvidenceLabel(booking)} / customer {partnerBookingCustomer(booking)}
        </>
      ),
      latestAt,
      steps: [
        {
          label: 'Address',
          value: booking.addressSnapshot ? 'Snapshot saved' : 'Review',
          tone: booking.addressSnapshot ? 'pill-success' : 'pill-warn',
        },
        {
          label: 'First-pick',
          value: firstPickValue,
          tone: record.relation === 'Preferred' || isFinalPartner ? 'pill-info' : 'pill-neutral',
        },
        {
          label: 'Open matching',
          value: marketplaceValue,
          tone: record.relation === 'Joined' ? 'pill-info' : 'pill-neutral',
        },
        {
          label: 'Customer choice',
          value: isFinalPartner ? 'Final partner' : 'Not final on this row',
          tone: isFinalPartner ? 'pill-success' : 'pill-neutral',
        },
        {
          label: 'Response',
          value: participant?.respondedAt ? (
            <>
              {participant.status} <DateTimeText fallback="Missing" value={participant.respondedAt} />
            </>
          ) : participant?.joinedAt ? (
            `${participant.status} participation`
          ) : (
            'No response row'
          ),
          tone: participant?.respondedAt
            ? 'pill-success'
            : participant?.joinedAt
              ? 'pill-info'
              : 'pill-neutral',
        },
        {
          label: 'Chat',
          value: hasChat ? `${chatMessages.length} retained` : partnerBookingChatEvidenceLabel(booking),
          tone: hasChat ? 'pill-success' : shouldHaveChat ? 'pill-warn' : 'pill-neutral',
        },
        {
          label: 'Money',
          value: moneyValue,
          tone: earning ? 'pill-success' : booking.payment ? 'pill-info' : 'pill-neutral',
        },
        {
          label: 'Wallet',
          value: walletRows.length ? `${walletRows.length} row(s)` : 'No row',
          tone: walletRows.length ? 'pill-info' : 'pill-neutral',
        },
      ],
      links: [
        { label: 'Open booking', href: `/bookings/${booking.id}` },
        ...(booking.customerProfileId
          ? [{ label: 'Open customer', href: `/customers/${booking.customerProfileId}` }]
          : []),
        ...(booking.chatRoom
          ? [{ label: 'Open chat archive', href: `/chat-archive?q=${encodeURIComponent(booking.id)}` }]
          : []),
      ],
    };
  });
}

function partnerChatMessageRole(
  message: ReturnType<typeof readPartnerChatMessages>[number],
): AdminChatWindowMessageRole {
  const roles = message.sender?.roles ?? [];
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  if (roles.includes('PROVIDER')) return 'PROVIDER';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return 'SYSTEM';
}

function partnerLocationSavedLabel() {
  return 'Latest Partner location saved for dispatch checks.';
}
