import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import {
  bookingParticipantProviderId,
  bookingPreferredProviderId,
} from './booking-participant-rules';

export const STALE_LOCATION_MINUTES = 30;
export const EXPIRED_LOCATION_HOURS = 24;

export function bookingStatusHint(status: string) {
  if (status === 'OPEN_MATCHING') {
    return 'Partner response or customer selection is still pending.';
  }
  if (status === 'MATCHED') {
    return 'Partner is selected; monitor chat and movement.';
  }
  if (status === 'IN_SERVICE') {
    return 'Service is in progress.';
  }
  if (status === 'COMPLETED') {
    return 'Payment, earning, and review should be settled.';
  }
  if (status === 'CANCELLED') {
    return 'Confirm payment release or refund.';
  }
  if (status === 'EXPIRED') {
    return 'Matching closed; confirm payment release and customer communication.';
  }
  if (status === 'NO_SHOW') {
    return 'Review customer/partner communication and payment outcome.';
  }
  return 'Monitor the next operational action.';
}

export function preferredParticipantState(booking: AdminBookingDetail) {
  const preferredProviderId = bookingPreferredProviderId(booking);
  if (!preferredProviderId) {
    return null;
  }

  return (
    (booking.participants ?? []).find(
      (participant) => bookingParticipantProviderId(participant) === preferredProviderId,
    ) ?? null
  );
}

export function latestProviderLocation(booking: AdminBookingDetail) {
  const selected = booking.selectedProvider?.locationSnapshots?.[0];
  if (selected) {
    return selected;
  }

  const participantLocations = (booking.participants ?? [])
    .map((participant) => participant.providerProfile?.locationSnapshots?.[0])
    .filter(Boolean) as AdminLocationSnapshot[];

  return (
    participantLocations.sort(
      (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
    )[0] ?? null
  );
}

export function latestProviderLocationFreshness(booking: AdminBookingDetail) {
  const latest = latestProviderLocation(booking);
  if (!latest?.recordedAt) {
    return 'missing';
  }

  const recordedAt = new Date(latest.recordedAt).getTime();
  if (!Number.isFinite(recordedAt)) {
    return 'missing';
  }

  const ageMs = Date.now() - recordedAt;
  if (ageMs > EXPIRED_LOCATION_HOURS * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > STALE_LOCATION_MINUTES * 60_000) {
    return 'stale';
  }
  return 'recent';
}

export function providerLocationAgeMinutes(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
}
