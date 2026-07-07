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
import { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
} from './booking-participant-rules';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';
import { readOptionalNumber } from './booking-readers';
import {
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
} from '../../../lib/operations-policy';

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
  marketplaceSupply,
  messageCount,
  financeTrace,
  walletDebt,
  terminal,
}: {
  booking: AdminBookingDetail;
  operationalPolicies: AdminOperationalPolicySetting[];
  marketplaceSupply: ReturnType<typeof bookingMarketplacePartnerSupply>;
  messageCount: number;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  walletDebt: boolean;
  terminal: boolean;
}): BookingMvpAuthorityContractRow[] {
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const responseWindowMinutes =
    savedPolicy.providerResponseWindowMinutes ??
    readOptionalNumber(
      adminOperationalPolicySettingByKey(
        operationalPolicies,
        OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
      )?.value,
    ) ??
    10;
  const radiusMeters =
    savedPolicy.backupProviderRadiusMeters ??
    readOptionalNumber(
      adminOperationalPolicySettingByKey(operationalPolicies, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters)
        ?.value,
    ) ??
    10000;
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const matchingEvidence = booking.matchingEvidence;
  const selectedPartner =
    booking.selectedProvider ??
    (matchingEvidence?.finalSelection === 'FIRST_PICK_ACCEPTED' ? booking.preferredProvider : null);
  const selectablePartnerCount =
    matchingEvidence?.selectableParticipantCount ?? customerChoiceCandidates.length;
  const pinReady = Number.isFinite(marketplaceSupply.policyPin.lat) && Number.isFinite(marketplaceSupply.policyPin.lng);
  const addressSnapshotReady = Boolean(booking.addressSnapshot);
  const chatReady = matchingEvidence?.chatReady ?? Boolean(booking.chatRoom);

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
      contract: 'Confirmed service address',
      scope: 'Required dispatch pin',
      status: addressSnapshotReady ? 'Address ready' : pinReady ? 'Stored pin only' : 'Missing pin',
      tone: addressSnapshotReady ? 'pill-success' : pinReady ? 'pill-warn' : 'pill-danger',
      evidence: `${bookingAddressSnapshotLabel(booking)} / ${marketplaceSupply.policyPin.label}`,
      operatorUse: 'Marketplace distance and evidence review should use the immutable booking address.',
      href: '#address-radius-contract',
    },
    {
      contract: 'First-pick window',
      scope: 'Preferred Partner response',
      status: booking.preferredProvider ? `${responseWindowMinutes}m window` : 'No preferred Partner',
      tone: booking.preferredProvider ? 'pill-info' : 'pill-warn',
      evidence: booking.preferredProvider
        ? `${providerName(booking.preferredProvider)} / expires ${
            booking.expiresAt ? formatDate(booking.expiresAt) : 'not saved'
          }`
        : 'The booking has no first-pick Partner record.',
      operatorUse:
        'Preferred Partner can become final if validly accepted first; otherwise customer reviews selectable participants.',
      href: '#customer-wait-panel',
    },
    {
      contract: '10km marketplace',
      scope: 'Booking-address radius',
      status: pinReady ? `${formatDistanceMeters(radiusMeters)} radius` : 'Blocked by missing pin',
      tone: pinReady ? (marketplaceSupply.eligibleCount ? 'pill-success' : 'pill-warn') : 'pill-danger',
      evidence: `${marketplaceSupply.eligibleCount} eligible / ${marketplaceSupply.rows.length} displayable supply row(s).`,
      operatorUse:
        'Only Partners within booking-address radius and fresh-location policy should enter the customer shortlist.',
      href: '#marketplace-supply',
    },
    {
      contract: 'Final Partner connection',
      scope: 'First-pick priority or customer choice',
      status: selectedPartner
        ? 'Final Partner selected'
        : selectablePartnerCount
          ? 'Customer choice pending'
          : 'Waiting for selectable Partner',
      tone: selectedPartner ? 'pill-success' : selectablePartnerCount ? 'pill-warn' : 'pill-info',
      evidence: selectedPartner
        ? providerName(selectedPartner)
        : `${selectablePartnerCount} customer-selectable Partner(s), ${booking.participants?.length ?? 0} participant(s).`,
      operatorUse:
        'Do not auto-assign; customer choice is required unless first-pick validly accepts first through the API.',
      href: '#participants',
    },
    {
      contract: 'Chat lifecycle',
      scope: 'Created after match, retained for Admin',
      status: chatReady ? 'Chat record ready' : selectedPartner ? 'Repair needed' : 'Locked until match',
      tone: chatReady ? 'pill-success' : selectedPartner ? 'pill-danger' : 'pill-info',
      evidence: chatReady
        ? `Room ${shortId(booking.chatRoom?.id ?? '')} / ${messageCount} message(s).`
        : 'No chat room is attached to this booking yet.',
      operatorUse: 'Matched work needs chat for coordination; completed work keeps transcript in admin.',
      href: '#chat',
    },
    {
      contract: 'Wallet settlement gate',
      scope: 'Negative wallet can see and participate in marketplace requests, but final acceptance and service start wait for settlement',
      status: walletDebt ? 'Settlement needed' : 'Gate clear',
      tone: walletDebt ? 'pill-danger' : 'pill-success',
      evidence: financeTrace.walletLedger,
      operatorUse:
        'Cash fee debt blocks final acceptance, service start, and payout release until settlement rules clear it.',
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
