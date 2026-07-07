import type { AdminBookingDetail } from '../../../lib/admin-api';
import { formatDistanceMeters } from '../../../lib/admin-format';
import {
  bookingAddressSnapshotLabel,
  distanceLabel,
  formatDate,
} from './booking-formatters';
import { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';
import { readBookingGateSnapshot } from './booking-policy-snapshots';

export function bookingAddressRadiusContract(
  booking: AdminBookingDetail,
  marketplaceSupply: ReturnType<typeof bookingMarketplacePartnerSupply>,
) {
  const pin = marketplaceSupply.policyPin;
  const bookingGate = readBookingGateSnapshot(booking);
  const snapshotLocked = Boolean(booking.addressSnapshot && pin.source === 'BookingAddressSnapshot');
  const driftMeters = pin.legacyDriftMeters;
  const driftLabel = driftMeters === null ? 'No stored-coordinate comparison' : distanceLabel(Math.round(driftMeters));
  const driftOk = driftMeters === null || driftMeters <= 100;
  const pinReady = Number.isFinite(pin.lat) && Number.isFinite(pin.lng);

  return {
    status: snapshotLocked && driftOk ? 'Snapshot locked' : pinReady ? 'Review pin' : 'Missing pin',
    tone: snapshotLocked && driftOk ? 'pill-success' : pinReady ? 'pill-warn' : 'pill-danger',
    metrics: [
      {
        label: 'Policy pin source',
        value: bookingAddressRadiusSourceLabel(pin.source),
        helper: snapshotLocked
          ? 'Marketplace distance is measured from the confirmed service address.'
          : 'Stored booking coordinates are being used because the confirmed address is missing.',
      },
      {
        label: 'Policy pin',
        value: pin.label,
        helper: bookingAddressSnapshotLabel(booking),
      },
      {
        label: 'Marketplace radius',
        value: formatDistanceMeters(marketplaceSupply.radiusMeters),
        helper: 'Partners outside this booking-address radius cannot participate in marketplace matching.',
      },
      {
        label: 'Stored coordinate drift',
        value: driftLabel,
        helper: driftOk
          ? 'Snapshot and stored coordinates are aligned.'
          : 'Snapshot and stored coordinates differ.',
      },
      {
        label: 'Optional customer GPS evidence',
        value: bookingGate.customerDistanceLabel,
        helper: bookingGate.customerDistanceHelper,
      },
      {
        label: 'First-pick distance gate',
        value: bookingGate.preferredPartnerDistanceLabel,
        helper: bookingGate.preferredPartnerDistanceHelper,
      },
    ],
    cards: [
      {
        title: 'Confirmed service address',
        status: snapshotLocked ? 'Required data ready' : 'Needs review',
        detail: snapshotLocked
          ? 'This booking has a confirmed service address for audit and dispatch.'
          : 'Create or repair the confirmed service address before relying on Partner radius decisions.',
        action: booking.addressSnapshot?.createdAt
          ? `Created ${formatDate(booking.addressSnapshot.createdAt)}`
          : 'No snapshot creation time available.',
        className: snapshotLocked ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: snapshotLocked ? 'pill-success' : 'pill-danger',
      },
      {
        title: '10km participation rule',
        status: pinReady ? 'Enforced by pin' : 'Blocked',
        detail: `Marketplace Partners are evaluated from ${bookingAddressRadiusSourceLabel(
          pin.source,
        )} and must be within ${formatDistanceMeters(marketplaceSupply.radiusMeters)}.`,
        action: `${marketplaceSupply.eligibleCount} eligible / ${marketplaceSupply.rows.length} displayable supply row(s).`,
        className: pinReady ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: pinReady ? 'pill-success' : 'pill-danger',
      },
      {
        title: 'Coordinate consistency',
        status: driftOk ? 'Aligned' : 'Drift found',
        detail: driftOk
          ? 'Stored booking coordinates do not conflict with the confirmed service address.'
          : 'Operators should verify customer address before extending the wait window.',
        action: `Drift ${driftLabel}`,
        className: driftOk ? 'ops-task-done' : 'ops-task-warning',
        pillClass: driftOk ? 'pill-success' : 'pill-warn',
      },
      {
        title: 'Booking creation gate',
        status: bookingGate.gatePassed ? 'Gate passed' : 'Needs evidence',
        detail:
          'Booking creation records the confirmed service address, optional customer GPS evidence, and preferred Partner distance before payment and matching open.',
        action: bookingGate.summary,
        className: bookingGate.gatePassed ? 'ops-task-done' : 'ops-task-warning',
        pillClass: bookingGate.gatePassed ? 'pill-success' : 'pill-warn',
      },
    ],
  };
}

function bookingAddressRadiusSourceLabel(source: string) {
  return source === 'BookingAddressSnapshot' ? 'confirmed service address' : 'stored booking location';
}
