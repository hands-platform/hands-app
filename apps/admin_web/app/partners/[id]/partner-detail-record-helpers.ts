import type { AdminAuditLog } from '../../../lib/admin-api';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { dateValue } from './partner-detail-format';

export type PartnerDetailBooking = {
  id: string;
  customerProfileId?: string;
  status?: string;
  notes?: string | null;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  createdAt?: string;
  updatedAt?: string;
  address?: unknown;
  addressSnapshot?: {
    id?: string;
    address?: unknown;
    addressText?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    createdAt?: string | null;
  } | null;
  lat?: string | number | null;
  lng?: string | number | null;
  closedAt?: string | null;
  closedByRole?: string | null;
  closedReason?: string | null;
  closedNote?: string | null;
  customerProfile?: {
    user?: { phone?: string | null; fullName?: string | null } | null;
  } | null;
  services?: Array<{
    id: string;
    price?: number;
    quantity?: number;
    service?: { name?: string; durationMin?: number | null } | null;
  }>;
  participants?: Array<{
    id: string;
    providerProfileId: string;
    status: string;
    joinedAt?: string;
    respondedAt?: string | null;
  }>;
  chatRoom?: {
    id: string;
    createdAt?: string;
    messages?: Array<{
      id: string;
      body: string;
      createdAt?: string;
      sender?: { phone?: string | null; fullName?: string | null; roles?: string[] | null } | null;
    }>;
  } | null;
  opsTasks?: Array<{
    id: string;
    type: string;
    status: string;
    note?: string | null;
    createdAt?: string;
    updatedAt?: string;
    actor?: { id?: string; phone?: string | null; fullName?: string | null } | null;
  }>;
  payment?: { method?: string; status?: string; amount?: number; currency?: string | null } | null;
  review?: { rating?: number; comment?: string | null; createdAt?: string } | null;
};

const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];

export function readPartnerChatMessages(booking: PartnerDetailBooking) {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  });
}

export function latestBookingManualNote(notes?: string | null) {
  if (!notes?.trim()) return null;
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const latest = lines[lines.length - 1];
  return latest ? trimText(latest, 180) : null;
}

export function bookingServiceLabel(booking: PartnerDetailBooking) {
  const labels = (booking.services ?? [])
    .map((item) => {
      const name = item.service?.name ?? 'Service';
      const duration = item.service?.durationMin ? ` ${item.service.durationMin}m` : '';
      return `${name}${duration}`;
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : 'No service';
}

export function bookingTotal(booking: PartnerDetailBooking) {
  return (booking.services ?? []).reduce((sum, item) => {
    return sum + (item.price ?? 0) * (item.quantity ?? 1);
  }, 0);
}

export function partnerBookingCustomer(booking: PartnerDetailBooking) {
  return (
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Unknown customer'
  );
}

export function partnerBookingAddressEvidenceLabel(booking: PartnerDetailBooking) {
  if (booking.addressSnapshot) {
    const snapshotText = stringifyPartnerAddress(
      booking.addressSnapshot.addressText ?? booking.addressSnapshot.address,
    );
    const snapshotLocationSaved =
      booking.addressSnapshot.latitude != null && booking.addressSnapshot.longitude != null;
    return `${snapshotText} / ${snapshotLocationSaved ? 'location record saved' : 'location record not stored'}`;
  }
  if (booking.address) {
    return stringifyPartnerAddress(booking.address);
  }
  if (booking.lat != null && booking.lng != null) {
    return 'Stored booking location saved';
  }
  return 'No booking address evidence loaded';
}

export function stringifyPartnerAddress(value: unknown) {
  if (!value) return 'No address text';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const address = value as Record<string, unknown>;
    const text =
      address.addressText ??
      address.address_text ??
      address.address ??
      address.formatted ??
      address.label ??
      address.name;
    if (typeof text === 'string' && text.trim()) return text;
    return trimText(JSON.stringify(address), 120);
  }
  return String(value);
}

export function partnerBookingChatEvidenceLabel(booking: PartnerDetailBooking) {
  const status = booking.status ?? '';
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(status)) {
    return 'Matched booking needs retained chat archive';
  }
  return 'No matched chat yet';
}

export function partnerBookingStatusPillClass(status?: string) {
  if (['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status ?? '')) {
    return 'pill-info';
  }
  if (status === 'COMPLETED') return 'pill-success';
  if (status === 'NO_SHOW') return 'pill-danger';
  if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(status ?? '')) return 'pill-warn';
  return 'pill-neutral';
}

export function isClosedPartnerBooking(booking: PartnerDetailBooking) {
  return CLOSED_BOOKING_STATUSES.includes(booking.status ?? '');
}

export function bookingClosureLabel(booking: PartnerDetailBooking) {
  const actor =
    booking.closedByRole === 'CUSTOMER'
      ? 'customer'
      : booking.closedByRole === 'PROVIDER'
        ? 'partner'
        : booking.closedByRole === 'ADMIN'
          ? 'admin'
          : 'system';
  const reason = booking.closedReason ? booking.closedReason.replace(/_/g, ' ') : 'no reason saved';
  const note = booking.closedNote ? ` / ${trimText(booking.closedNote, 90)}` : '';
  return `${actor} closure / ${reason}${note}`;
}

export function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function readMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function auditLogNoteText(log: AdminAuditLog) {
  const metadata = readMetadataObject(log.metadata);
  const note = metadata.note ?? metadata.preset ?? metadata.reason ?? metadata.summary ?? metadata.status;
  if (typeof note === 'string' && note.trim()) {
    return trimText(marketplaceDisplayText(note.trim()), 140);
  }
  return trimText(safeAuditMetadataText(metadata) || 'Action details recorded', 140);
}

function safeAuditMetadataText(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .flatMap(([key, value]) => {
      if (isInternalAuditMetadataKey(key) || value === null || value === undefined) return [];
      if (typeof value === 'object') return [];
      const label = humanizeAuditMetadataKey(key);
      const displayValue = marketplaceDisplayText(String(value).trim());
      return displayValue ? [`${label}: ${displayValue}`] : [];
    })
    .slice(0, 3)
    .join(' / ');
}

function isInternalAuditMetadataKey(key: string) {
  return /(?:^|_)?id$/i.test(key) || key.toLowerCase().includes('providerprofile');
}

function humanizeAuditMetadataKey(key: string) {
  return marketplaceDisplayText(
    key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase()),
  );
}
