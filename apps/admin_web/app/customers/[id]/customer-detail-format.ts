import type { AdminBookingDetail } from '../../../lib/admin-api';
import { marketplaceDisplayText as displayMarketplaceText } from '../../../lib/admin-copy';
import {
  formatDateTime,
  formatDistanceMeters,
  formatMoneyOrZero as formatMoney,
  shortUnknownId as shortId,
} from '../../../lib/admin-format';

export { formatMoney, shortId };

export function compactJson(value: unknown) {
  if (!value) return 'No metadata';
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
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

export function compactText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

export function bookingPartnerDisplayName(booking: AdminBookingDetail) {
  return displayMarketplaceText(
    booking.selectedProvider?.displayName ??
      booking.preferredProvider?.displayName ??
      booking.selectedProvider?.user?.fullName ??
      booking.preferredProvider?.user?.fullName ??
      'No partner',
  );
}

export function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function formatDate(value?: string | null) {
  return formatDateTime(value, 'Not set');
}

export function formatDistance(value: number) {
  return formatDistanceMeters(value);
}
