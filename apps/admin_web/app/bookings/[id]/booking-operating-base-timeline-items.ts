import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingClosureSummary } from '../../../lib/booking-closure-summary';
import { bookingProviderLocationMetricHelper } from '../../../lib/booking-provider-location-copy';
import {
  bookingServiceOptionLabel,
  compactActivityText,
  distanceLabel,
  providerName,
} from './booking-formatters';
import type { BookingOperatingTimelineItem } from './booking-operating-timeline-items';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';

export function bookingOperatingBaseTimelineItems({
  booking,
  addressLine,
  addressPin,
  latestLocation,
  messages,
}: {
  readonly booking: AdminBookingDetail;
  readonly addressLine: string;
  readonly addressPin: string;
  readonly latestLocation?: AdminLocationSnapshot;
  readonly messages: readonly AdminChatMessage[];
}): BookingOperatingTimelineItem[] {
  const items: BookingOperatingTimelineItem[] = [
    {
      id: `created-${booking.id}`,
      type: 'BOOK',
      title: 'Booking created',
      detail: `${booking.customerProfile?.user?.phone ?? 'Customer'} requested ${bookingServiceOptionLabel(booking)}.`,
      at: booking.createdAt,
      status: 'Recorded',
    },
    {
      id: `address-${booking.addressSnapshot?.id ?? booking.id}`,
      type: 'ADDR',
      title: booking.addressSnapshot ? 'Confirmed address locked' : 'Confirmed address missing',
      detail: booking.addressSnapshot
        ? `${compactActivityText(addressLine, 84)} / ${addressSnapshotStateLabel(addressPin)}`
        : 'This booking is still using older address data. Confirm before dispatch.',
      at: booking.addressSnapshot?.createdAt,
      status: booking.addressSnapshot ? 'Locked' : 'Pending',
    },
  ];

  if (booking.openedAt || booking.status !== 'CREATED') {
    items.push({
      id: `matching-opened-${booking.id}`,
      type: 'MATCH',
      title: 'Matching window opened',
      detail: booking.preferredProvider
        ? `First-pick Partner: ${providerName(booking.preferredProvider)}.`
        : 'No first-pick Partner is attached to this booking.',
      at: booking.openedAt ?? booking.createdAt,
      status: 'Open',
    });
  }

  if (booking.expiresAt) {
    items.push({
      id: `expires-${booking.id}`,
      type: 'TTL',
      title: 'Auto-close timer set',
      detail: 'If no final Partner is selected before this time, operations should close or follow up.',
      at: booking.expiresAt,
      status: 'Timer',
    });
  }

  if (booking.closedAt) {
    items.push({
      id: `closed-${booking.id}`,
      type: 'CLOSE',
      title: 'Booking closure recorded',
      detail: bookingClosureSummary(booking).detail,
      at: booking.closedAt,
      status: booking.closedReason ?? booking.closedByRole ?? 'Closed',
    });
  }

  for (const participant of booking.participants ?? []) {
    const partnerName = providerName(participant.providerProfile);
    items.push({
      id: `participant-joined-${participant.id}`,
      type: 'JOIN',
      title: `${partnerName} entered marketplace shortlist`,
      detail: `${participant.status} / ${distanceLabel(participant.distanceMeters)} / ${
        participant.providerStatusAtJoin ?? 'status unknown'
      }`,
      at: participant.joinedAt,
      status: 'Participating',
    });
    if (participant.respondedAt) {
      items.push({
        id: `participant-responded-${participant.id}`,
        type: 'REPLY',
        title: `${partnerName} responded`,
        detail: `Partner response recorded as ${participant.status}.`,
        at: participant.respondedAt,
        status: participant.status,
      });
    }
  }

  if (booking.selectedProvider) {
    items.push({
      id: `selected-${booking.selectedProvider.id ?? booking.id}`,
      type: 'SELECT',
      title: 'Customer final Partner selected',
      detail: `${providerName(booking.selectedProvider)} is the final customer-selected Partner.`,
      at: booking.updatedAt,
      status: 'Selected',
    });
  } else if (booking.status === 'OPEN_MATCHING') {
    items.push({
      id: `selection-pending-${booking.id}`,
      type: 'SELECT',
      title: 'Customer final choice pending',
      detail: 'Customer still needs to select one final Partner before chat handoff.',
      status: 'Pending',
    });
  }

  if (booking.chatRoom) {
    items.push({
      id: `chat-ready-${booking.chatRoom.id}`,
      type: 'CHAT',
      title: 'Chat room ready',
      detail: `${messages.length} message(s) are retained for admin support.`,
      at: messages[0]?.createdAt ?? booking.updatedAt,
      status: 'Ready',
    });
  } else if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    items.push({
      id: `chat-missing-${booking.id}`,
      type: 'CHAT',
      title: 'Chat handoff missing',
      detail: 'Matched or active booking has no chat room linked yet.',
      status: 'Repair',
    });
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    items.push({
      id: `chat-last-${lastMessage.id}`,
      type: 'MSG',
      title: 'Latest chat message',
      detail: `${lastMessage.sender?.fullName ?? lastMessage.sender?.phone ?? 'Sender'}: ${compactActivityText(
        lastMessage.body,
        90,
      )}`,
      at: lastMessage.createdAt,
      status: 'Message',
    });
  }

  if (latestLocation) {
    items.push({
      id: `location-${latestLocation.id}`,
      type: 'LOC',
      title: 'Latest Partner location shared',
      detail: `${latestLocationLabel(latestLocation)} / ${bookingProviderLocationMetricHelper(
        latestLocation.recordedAt,
      )}`,
      at: latestLocation.recordedAt,
      status: 'Location',
    });
  } else if (['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    items.push({
      id: `location-missing-${booking.id}`,
      type: 'LOC',
      title: 'Partner location not shared',
      detail: 'Active service state has no linked Partner location snapshot.',
      status: 'Pending',
    });
  }

  return items;
}

function addressSnapshotStateLabel(addressPin: string) {
  return readAddressText(addressPin) ? serviceAddressAreaLabel(addressPin) : 'confirmed service address saved';
}

function latestLocationLabel(latestLocation: AdminLocationSnapshot) {
  const address = readAddressText(latestLocation);
  return address ? serviceAddressAreaLabel(address) : 'Location recorded without readable address';
}
