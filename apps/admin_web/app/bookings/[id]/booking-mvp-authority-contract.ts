import type {
  AdminBookingDetail,
  AdminOperationalPolicySetting,
} from '../../../lib/admin-api';
import { formatDistanceMeters } from '../../../lib/admin-format';
import { bookingFinanceTrace } from './booking-finance-trace';
import {
  bookingAddressSnapshotLabel,
  formatDate,
  providerName,
  shortId,
} from './booking-formatters';
import { bookingBackupPartnerSupply } from './booking-marketplace-supply';
import {
  bookingPreferredProviderId,
  isCustomerSelectableParticipantForFinalChoice,
} from './booking-participant-rules';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';
import { readOptionalNumber } from './booking-readers';

export type BookingMvpAuthorityContractRow = {
  contract: string;
  scope: string;
  status: string;
  tone: 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';
  evidence: string;
  operatorUse: string;
  href: string;
};

export function bookingMvpAuthorityContract({
  booking,
  operationalPolicies,
  backupSupply,
  messageCount,
  financeTrace,
  walletDebt,
  terminal,
}: {
  booking: AdminBookingDetail;
  operationalPolicies: AdminOperationalPolicySetting[];
  backupSupply: ReturnType<typeof bookingBackupPartnerSupply>;
  messageCount: number;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  walletDebt: boolean;
  terminal: boolean;
}): BookingMvpAuthorityContractRow[] {
  const byKey = new Map(operationalPolicies.map((setting) => [setting.key, setting]));
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const responseWindowMinutes =
    savedPolicy.providerResponseWindowMinutes ??
    readOptionalNumber(byKey.get('matching.provider_response_window_minutes')?.value) ??
    10;
  const radiusMeters =
    savedPolicy.backupProviderRadiusMeters ??
    readOptionalNumber(byKey.get('matching.backup_provider_radius_meters')?.value) ??
    10000;
  const customerChoiceCandidates = (booking.participants ?? []).filter((participant) =>
    isCustomerSelectableParticipantForFinalChoice(participant, bookingPreferredProviderId(booking)),
  );
  const selectedPartner =
    booking.selectedProvider ?? (booking.status === 'MATCHED' ? booking.preferredProvider : null);
  const pinReady = Number.isFinite(backupSupply.policyPin.lat) && Number.isFinite(backupSupply.policyPin.lng);
  const addressSnapshotReady = Boolean(booking.addressSnapshot);
  const chatReady = Boolean(booking.chatRoom);

  return [
    {
      contract: 'Business authority',
      scope: 'Supabase infra, NestJS decisions',
      status: 'NestJS authoritative',
      tone: 'pill-success',
      evidence:
        'Supabase stores auth/storage/realtime infrastructure; API/admin policy owns booking permissions.',
      operatorUse: 'Use API state and audit rows for booking decisions, not client-only state.',
      href: '#operator-action-availability',
    },
    {
      contract: 'Booking address snapshot',
      scope: 'Required dispatch pin',
      status: addressSnapshotReady ? 'Snapshot ready' : pinReady ? 'Stored pin only' : 'Missing pin',
      tone: addressSnapshotReady ? 'pill-success' : pinReady ? 'pill-warn' : 'pill-danger',
      evidence: `${bookingAddressSnapshotLabel(booking)} / ${backupSupply.policyPin.label}`,
      operatorUse: 'Marketplace distance and evidence review should use the immutable booking address.',
      href: '#address-radius-contract',
    },
    {
      contract: 'First-pick window',
      scope: 'Preferred partner response',
      status: booking.preferredProvider ? `${responseWindowMinutes}m window` : 'No preferred partner',
      tone: booking.preferredProvider ? 'pill-info' : 'pill-warn',
      evidence: booking.preferredProvider
        ? `${providerName(booking.preferredProvider)} / expires ${
            booking.expiresAt ? formatDate(booking.expiresAt) : 'not saved'
          }`
        : 'The booking has no first-pick partner record.',
      operatorUse: 'Preferred partner gets the first response window; customer still chooses final partner.',
      href: '#customer-wait-panel',
    },
    {
      contract: '10km marketplace',
      scope: 'Booking-address radius',
      status: pinReady ? `${formatDistanceMeters(radiusMeters)} radius` : 'Blocked by missing pin',
      tone: pinReady ? (backupSupply.eligibleCount ? 'pill-success' : 'pill-warn') : 'pill-danger',
      evidence: `${backupSupply.eligibleCount} eligible / ${backupSupply.rows.length} partner row(s) sampled.`,
      operatorUse:
        'Only partners within booking-address radius and fresh-location policy should enter the candidate list.',
      href: '#marketplace-supply',
    },
    {
      contract: 'Customer final choice',
      scope: 'No automatic assignment',
      status: selectedPartner
        ? 'Final partner selected'
        : customerChoiceCandidates.length
          ? 'Customer choice pending'
          : 'Waiting for selectable partner',
      tone: selectedPartner ? 'pill-success' : customerChoiceCandidates.length ? 'pill-warn' : 'pill-info',
      evidence: selectedPartner
        ? providerName(selectedPartner)
        : `${customerChoiceCandidates.length} customer-selectable partner(s), ${booking.participants?.length ?? 0} participant(s).`,
      operatorUse: 'Do not auto-assign; keep the customer selection step visible before matched chat opens.',
      href: '#participants',
    },
    {
      contract: 'Chat lifecycle',
      scope: 'Created after match, retained for admin',
      status: chatReady ? 'Chat archived' : selectedPartner ? 'Repair needed' : 'Locked until match',
      tone: chatReady ? 'pill-success' : selectedPartner ? 'pill-danger' : 'pill-info',
      evidence: chatReady
        ? `Room ${shortId(booking.chatRoom?.id ?? '')} / ${messageCount} message(s).`
        : 'No chat room is attached to this booking yet.',
      operatorUse: 'Matched work needs chat for coordination; completed work keeps transcript in admin.',
      href: '#chat',
    },
    {
      contract: 'Wallet participation gate',
      scope: 'Negative wallet can see marketplace demand, but cannot participate',
      status: walletDebt ? 'Settlement needed' : 'Gate clear',
      tone: walletDebt ? 'pill-danger' : 'pill-success',
      evidence: financeTrace.walletLedger,
      operatorUse:
        'Cash fee debt blocks marketplace participation and payout release until settlement rules clear it.',
      href: '#finance',
    },
    {
      contract: 'On-demand service rules',
      scope: 'No schedule picker and no optional customer add-on payment flow',
      status: terminal ? 'Closeout record' : 'On-demand active',
      tone: 'pill-success',
      evidence: `${financeTrace.serviceOption} / payment ${booking.payment?.method ?? 'NONE'} / no optional add-on payment lane.`,
      operatorUse:
        'Keep scheduling and optional customer add-on payment decisions out of MVP booking flow; use policy/admin closeout records.',
      href: '#service',
    },
  ];
}
