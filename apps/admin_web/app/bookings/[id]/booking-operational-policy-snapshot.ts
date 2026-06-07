import type { AdminBookingDetail, AdminOperationalPolicySetting } from '../../../lib/admin-api';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
} from './booking-participant-rules';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';

export function bookingOperationalPolicySnapshot(
  booking: AdminBookingDetail,
  settings: AdminOperationalPolicySetting[],
) {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const savedMatchingPolicy = readBookingMatchingPolicySnapshot(booking);
  const responseWindow = byKey.get('matching.provider_response_window_minutes');
  const backupRadius = byKey.get('matching.backup_provider_radius_meters');
  const backupLocationFreshness = byKey.get('matching.backup_provider_location_max_age_minutes');
  const travelBuffer = byKey.get('matching.travel_buffer_minutes');
  const acceptMode = byKey.get('matching.preferred_accept_mode');
  const backupOpenMode = byKey.get('matching.backup_open_mode');
  const walletGate = byKey.get('wallet.negative_balance_gate');
  const actionEvidenceGateMode = byKey.get('decision.action_evidence_gate_mode');
  const cashSettlementClearancePolicy = byKey.get('cash.settlement_clearance_policy');
  const firstPickExpiryActionPolicy = byKey.get('matching.first_pick_expiry_action_policy');
  const cancellationPolicy = byKey.get('cancellation.after_match_policy');
  const noShowEvidenceRequirementPolicy = byKey.get('no_show.evidence_requirement_policy');
  const noShowPolicy = byKey.get('no_show.partner_report_policy');
  const partnerAlertPolicy = byKey.get('notification.partner_alert_channel');
  const payoutBatchCyclePolicy = byKey.get('payout.batch_cycle_policy');
  const expiresAt = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const minutesLeft =
    expiresAt === null || Number.isNaN(expiresAt)
      ? null
      : Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const selected = booking.status === 'MATCHED' || Boolean(booking.selectedProvider);
  const customerConfirmMode = String(acceptMode?.value) === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

  const decisionTitle = customerConfirmMode
    ? 'Customer final confirmation mode'
    : 'Historical accept mode ignored';
  const decisionStatus =
    customerConfirmMode && customerChoiceCandidates.length > 0 && !selected
      ? 'Customer action needed'
      : acceptMode?.enforced
        ? 'Policy enforced'
        : 'Policy default';
  const decisionTone =
    customerConfirmMode && customerChoiceCandidates.length > 0 && !selected ? 'pill-warn' : 'pill-success';
  const decisionDetail = customerConfirmMode
    ? customerChoiceCandidates.length > 0 && !selected
      ? 'A partner participated or accepted, but the customer still needs to confirm the final partner before matched chat opens.'
      : 'Preferred partner acceptance keeps the request open until the customer confirms the final partner.'
    : 'Preferred partner acceptance immediately locks the booking to that partner.';

  return {
    decisionTitle,
    decisionStatus,
    decisionTone,
    decisionDetail,
    decisionCards: [
      bookingPolicyDecisionCard({
        setting: backupOpenMode,
        key: 'matching.backup_open_mode',
        label: 'Marketplace participation',
        helper:
          String(backupOpenMode?.value) === 'AFTER_FIRST_PICK_DELAY'
            ? 'Marketplace partners are hidden until the preferred partner window passes, but open immediately if that partner declines.'
            : 'Eligible nearby partners can participate while the preferred partner is still deciding.',
        enforced: true,
      }),
      bookingPolicyDecisionCard({
        setting: walletGate,
        key: 'wallet.negative_balance_gate',
        label: 'Wallet debt gate',
        helper:
          String(walletGate?.value) === 'ALLOW_ONE_RECOVERY_BOOKING'
            ? 'Historical recovery mode is visible for audit only; current operations should settle debt before marketplace participation.'
            : 'Negative wallet partners can see marketplace requests, but marketplace participation and payout release are blocked.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: actionEvidenceGateMode,
        key: 'decision.action_evidence_gate_mode',
        label: 'Action evidence gate',
        helper:
          String(actionEvidenceGateMode?.value) === 'STRICT_EVIDENCE_REQUIRED'
            ? 'Money and closeout actions should wait for strict retained evidence before operators proceed.'
            : 'Operators should review retained payment, chat, address, wallet, alert, and audit evidence before manual actions.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: cashSettlementClearancePolicy,
        key: 'cash.settlement_clearance_policy',
        label: 'Cash fee clearance',
        helper:
          String(cashSettlementClearancePolicy?.value) === 'DEPOSIT_REFERENCE_REQUIRED'
            ? 'Cash fee debt clearance should include a company deposit reference before marketplace participation reopens.'
            : 'Cash fee debt can clear through verified company deposit or approved admin offset with evidence.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: firstPickExpiryActionPolicy,
        key: 'matching.first_pick_expiry_action_policy',
        label: 'First-pick expiry',
        helper:
          String(firstPickExpiryActionPolicy?.value) === 'EXPIRE_ONLY_AFTER_OPERATOR_REVIEW'
            ? 'Do not expire automatically; operators review first-pick timeout and available partners.'
            : 'After first-pick timeout, marketplace alternatives can remain visible while operators review the request.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: cancellationPolicy,
        key: 'cancellation.after_match_policy',
        label: 'After-match cancellation',
        helper:
          booking.status === 'CANCELLED'
            ? 'Use this policy to decide release, refund, or fee review for this cancelled booking.'
            : 'Applies if the customer cancels after a partner has accepted or been selected.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: noShowEvidenceRequirementPolicy,
        key: 'no_show.evidence_requirement_policy',
        label: 'No-show evidence requirement',
        helper:
          String(noShowEvidenceRequirementPolicy?.value) === 'CHAT_AND_OPERATOR_NOTE_REQUIRED'
            ? 'No-show closeout should include chat evidence and an operator note before money handling.'
            : 'No-show closeout should use retained factual records such as chat, alert, location, or operator notes.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: noShowPolicy,
        key: 'no_show.partner_report_policy',
        label: 'No-show handling',
        helper:
          booking.status === 'NO_SHOW'
            ? 'Use this policy to review evidence before payment or support closeout.'
            : 'Applies if a no-show closeout needs operator review later.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: partnerAlertPolicy,
        key: 'notification.partner_alert_channel',
        label: 'Partner alert route',
        helper:
          String(partnerAlertPolicy?.value) === 'ONESIGNAL_FOR_ALL_BOOKINGS'
            ? 'Booking and marketplace alerts should create OneSignal delivery logs.'
            : 'Partner alerts are kept in the app inbox until production push is ready.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: payoutBatchCyclePolicy,
        key: 'payout.batch_cycle_policy',
        label: 'Payout batch cycle',
        helper:
          String(payoutBatchCyclePolicy?.value) === 'ADMIN_SELECTED_DAY_BATCH'
            ? 'Positive partner earnings remain pending until the admin-selected payout day batch is released.'
            : String(payoutBatchCyclePolicy?.value) === 'HYBRID_ADMIN_REVIEW'
              ? 'Positive partner earnings are grouped into planned payout batches with admin exception review before release.'
              : 'Positive partner earnings are settled through weekly or monthly payout batches, not booking-by-booking release.',
        enforced: false,
      }),
    ],
    metrics: [
      {
        label: 'Response window',
        value:
          bookingPolicySnapshotNumberLabel(savedMatchingPolicy.providerResponseWindowMinutes, 'minutes') ??
          bookingPolicyValueLabel(responseWindow),
        helper:
          minutesLeft === null
            ? bookingPolicySnapshotHelper(
                savedMatchingPolicy.providerResponseWindowMinutes,
                responseWindow,
                'No active countdown saved.',
              )
            : `${minutesLeft} min left. ${bookingPolicySnapshotHelper(
                savedMatchingPolicy.providerResponseWindowMinutes,
                responseWindow,
                'Live policy default.',
              )}`,
      },
      {
        label: 'Marketplace radius',
        value:
          bookingPolicySnapshotNumberLabel(savedMatchingPolicy.backupProviderRadiusMeters, 'meters') ??
          bookingPolicyValueLabel(backupRadius),
        helper: bookingPolicySnapshotHelper(
          savedMatchingPolicy.backupProviderRadiusMeters,
          backupRadius,
          'Nearby partners outside this distance cannot participate.',
        ),
      },
      {
        label: 'Location freshness',
        value:
          bookingPolicySnapshotNumberLabel(
            savedMatchingPolicy.backupProviderLocationMaxAgeMinutes,
            'minutes',
          ) ?? bookingPolicyValueLabel(backupLocationFreshness),
        helper: bookingPolicySnapshotHelper(
          savedMatchingPolicy.backupProviderLocationMaxAgeMinutes,
          backupLocationFreshness,
          'Marketplace partners with older locations cannot participate.',
        ),
      },
      {
        label: 'Travel buffer',
        value:
          bookingPolicySnapshotNumberLabel(savedMatchingPolicy.travelBufferMinutes, 'minutes') ??
          bookingPolicyValueLabel(travelBuffer),
        helper: bookingPolicySnapshotHelper(
          savedMatchingPolicy.travelBufferMinutes,
          travelBuffer,
          'Applied before nearby availability is calculated.',
        ),
      },
      {
        label: 'Accept mode',
        value: bookingPolicySnapshotOptionLabel(savedMatchingPolicy.preferredAcceptMode, acceptMode),
        helper: selected
          ? `Booking has a final partner. ${bookingPolicySnapshotHelper(
              savedMatchingPolicy.preferredAcceptMode,
              acceptMode,
              'Live policy default.',
            )}`
          : `Booking is still waiting for final selection. ${bookingPolicySnapshotHelper(
              savedMatchingPolicy.preferredAcceptMode,
              acceptMode,
              'Live policy default.',
            )}`,
      },
    ],
  };
}

function bookingPolicySnapshotNumberLabel(value: number | null, unit: 'meters' | 'minutes') {
  if (value === null) {
    return null;
  }
  if (unit === 'meters') {
    return `${(value / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  return `${value} min`;
}

function bookingPolicySnapshotOptionLabel(value: string | null, setting?: AdminOperationalPolicySetting) {
  if (!value) {
    return bookingPolicyOptionLabel(setting);
  }
  return setting?.options?.find((option) => option.value === value)?.label ?? value;
}

function bookingPolicySnapshotHelper(
  savedValue: number | string | null,
  liveSetting: AdminOperationalPolicySetting | undefined,
  fallback: string,
) {
  if (savedValue === null) {
    return fallback;
  }
  const liveValue = liveSetting?.value;
  if (liveValue !== undefined && liveValue !== null && String(liveValue) !== String(savedValue)) {
    return `Saved on booking open. Current policy is ${bookingPolicyOptionLabel(liveSetting)}.`;
  }
  return 'Saved on booking open and aligned with current policy.';
}

function bookingPolicyValueLabel(setting?: AdminOperationalPolicySetting) {
  if (!setting) {
    return '-';
  }

  const value = setting.value;
  if (setting.unit === 'meters') {
    return `${(Number(value) / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  if (setting.unit === 'minutes') {
    return `${value} min`;
  }
  return String(value);
}

function bookingPolicyOptionLabel(setting?: AdminOperationalPolicySetting) {
  if (!setting) {
    return '-';
  }

  const value = String(setting.value);
  return setting.options?.find((option) => option.value === value)?.label ?? bookingPolicyValueLabel(setting);
}

function bookingPolicyDecisionCard(input: {
  setting?: AdminOperationalPolicySetting;
  key: string;
  label: string;
  helper: string;
  enforced: boolean;
}) {
  const settingEnforced = input.setting?.enforced ?? input.enforced;
  const aligned =
    input.setting?.recommendedValue === null || input.setting?.recommendedValue === undefined
      ? true
      : String(input.setting?.value) === String(input.setting?.recommendedValue);

  return {
    key: input.key,
    label: input.label,
    value: bookingPolicyOptionLabel(input.setting),
    helper: input.helper,
    status: settingEnforced ? 'Live' : aligned ? 'Recommended' : 'Owner choice',
    className: aligned ? 'ops-task-done' : 'ops-task-pending',
    pillClass: settingEnforced ? 'pill-success' : aligned ? 'pill-info' : 'pill-warn',
  };
}
