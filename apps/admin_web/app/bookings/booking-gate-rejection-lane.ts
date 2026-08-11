import type { AdminAuditLog } from '../../lib/admin-api';
import { adminCountLabel } from '../../lib/admin-copy';
import type { BookingCommandCenterLane } from './booking-command-center-board';
import { bookingGateRejectionLaneFacts } from './booking-gate-rejection-lane-facts';
import { bookingGateReasonCode } from './booking-gate-rejections';
import { relativeTimeLabel } from './booking-list-time';

export function buildBookingGateRejectionLane(
  logs: readonly AdminAuditLog[],
  nowMs: number,
): BookingCommandCenterLane {
  const facts = bookingGateRejectionLaneFacts(
    logs.map((log) => ({
      createdAt: log.createdAt,
      reasonCode: bookingGateReasonCode(log),
    })),
    { relativeTimeLabel: (value) => relativeTimeLabel(value, nowMs) },
  );

  return {
    title: 'Blocked booking attempts',
    status: facts.totalCount > 0 ? `${facts.totalCount} stopped` : 'Clear',
    tone: facts.totalCount > 0 ? 'warn' : 'ok',
    detail:
      facts.totalCount > 0
        ? `${facts.customerTooFarCount} customer distance, ${facts.partnerTooFarCount} first-pick distance, ${facts.serviceAreaCount} service-area, and ${adminCountLabel(facts.locationEvidenceCount, 'optional GPS evidence attempt')}. Latest ${facts.latestAge}.`
        : 'No booking create request has been blocked by the local booking gates.',
    href: '/bookings?view=blocked-create',
    metrics: [
      { label: 'Customer distance gate', value: facts.customerTooFarCount.toString() },
      { label: 'First-pick distance', value: facts.partnerTooFarCount.toString() },
      { label: 'Service area', value: facts.serviceAreaCount.toString() },
      { label: 'Optional GPS evidence attempts', value: facts.locationEvidenceCount.toString() },
      { label: 'Latest', value: facts.latestAge },
    ],
  };
}
