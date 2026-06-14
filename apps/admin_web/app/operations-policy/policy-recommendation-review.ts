import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import {
  LEGACY_OPERATIONAL_POLICY_KEYS,
  OPERATIONAL_POLICY_KEYS,
  adminWalletGateBlocksMarketplaceParticipation,
} from '../../lib/operations-policy';
import { policyDisplayValue } from './policy-value-display';

export type PolicyRecommendationReview = {
  readonly warningCount: number;
  readonly summary: readonly PolicyRecommendationSummaryItem[];
  readonly cards: readonly PolicyRecommendationCard[];
};

type PolicyRecommendationSummaryItem = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
};

type PolicyRecommendationCard = {
  readonly key: string;
  readonly label: string;
  readonly status: string;
  readonly detail: string;
  readonly operatorAction: string;
  readonly className: string;
  readonly pillClass: string;
};

type PolicyRecommendationInternalCard = PolicyRecommendationCard & {
  readonly aligned: boolean;
  readonly enforced: boolean;
};

type PolicyRecommendationContext = {
  readonly activeBookingCount: number;
  readonly openMatchingCount: number;
};

const ACTIVE_BOOKING_STATUSES = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

export function buildPolicyRecommendationReview(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
): PolicyRecommendationReview {
  const context = buildPolicyRecommendationContext(bookings);
  const reviewable = policyRecommendationReviewableSettings(settings);
  const cards = buildPolicyRecommendationCards(reviewable, context);
  const warningCount = cards.filter((card) => !card.aligned).length;
  const enforcedWarningCount = cards.filter((card) => !card.aligned && card.enforced).length;

  return {
    warningCount,
    summary: buildPolicyRecommendationSummary({
      activeBookingCount: context.activeBookingCount,
      enforcedWarningCount,
      reviewableCount: reviewable.length,
      warningCount,
    }),
    cards,
  };
}

function buildPolicyRecommendationContext(
  bookings: readonly AdminBooking[],
): PolicyRecommendationContext {
  return {
    activeBookingCount: bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status)).length,
    openMatchingCount: bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length,
  };
}

function policyRecommendationReviewableSettings(
  settings: readonly AdminOperationalPolicySetting[],
) {
  return settings.filter(
    (setting) => setting.recommendedValue !== null && setting.recommendedValue !== undefined,
  );
}

function buildPolicyRecommendationCards(
  settings: readonly AdminOperationalPolicySetting[],
  context: PolicyRecommendationContext,
): PolicyRecommendationInternalCard[] {
  return settings.map((setting) => buildPolicyRecommendationCard(setting, context));
}

function buildPolicyRecommendationCard(
  setting: AdminOperationalPolicySetting,
  context: PolicyRecommendationContext,
): PolicyRecommendationInternalCard {
  const aligned = String(setting.value) === String(setting.recommendedValue);
  const posture = policyRecommendationPosture(setting, context);

  return {
    key: setting.key,
    label: displayOperationalWording(setting.label),
    status: aligned ? 'Recommended' : posture.status,
    detail: aligned
      ? `Current value matches the recommended baseline: ${policyDisplayValue(setting)}.`
      : `Current value is ${policyDisplayValue(setting)}; recommended is ${policyDisplayValue(setting, true)}. ${posture.detail}`,
    operatorAction: aligned ? posture.alignedAction : posture.operatorAction,
    className: aligned ? 'ops-task-done' : posture.className,
    pillClass: aligned ? 'pill-success' : posture.pillClass,
    aligned,
    enforced: setting.enforced,
  };
}

function buildPolicyRecommendationSummary(input: {
  readonly activeBookingCount: number;
  readonly enforcedWarningCount: number;
  readonly reviewableCount: number;
  readonly warningCount: number;
}): PolicyRecommendationReview['summary'] {
  return [
    {
      label: 'Compared policies',
      value: String(input.reviewableCount),
      helper: 'Policies with an explicit recommended baseline.',
    },
    {
      label: 'Owner choices',
      value: String(input.warningCount),
      helper: 'Current values intentionally different from recommendation.',
    },
    {
      label: 'Live deviations',
      value: String(input.enforcedWarningCount),
      helper: 'Differences that can affect live booking behavior.',
    },
    {
      label: 'Active bookings',
      value: String(input.activeBookingCount),
      helper: 'Bookings to consider before changing enforced values.',
    },
  ];
}

function policyRecommendationPosture(
  setting: AdminOperationalPolicySetting,
  context: PolicyRecommendationContext,
) {
  const value = String(setting.value);
  const recommended = String(setting.recommendedValue);
  const numericValue = Number(setting.value);
  const numericRecommended = Number(setting.recommendedValue);
  const liveContext =
    context.openMatchingCount > 0
      ? `${context.openMatchingCount} open matching booking(s) may feel this policy while active.`
      : 'No open matching booking is currently exposed to this policy.';

  if (setting.key === OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) {
    const shorter =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue < numericRecommended;
    return {
      status: shorter ? 'Faster than baseline' : 'Slower than baseline',
      detail: shorter
        ? 'This can reduce waiting time but may make first-pick Partners miss requests.'
        : 'This gives Partners more time but increases customer waiting anxiety.',
      operatorAction: `${liveContext} Existing booking countdowns do not recalculate.`,
      alignedAction: 'Keep monitoring first-pick response rate and cancellation during the waiting window.',
      className: shorter ? 'ops-task-pending' : 'ops-task-blocked',
      pillClass: shorter ? 'pill-warn' : 'pill-danger',
    };
  }

  if (
    policyKeyMatches(setting.key, [
      OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
    ])
  ) {
    const narrower =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue < numericRecommended;
    return {
      status: narrower ? 'Narrow supply' : 'Wide supply',
      detail: narrower
        ? 'Fewer partners can participate in marketplace matching, so customer alternatives may look empty.'
        : 'More partners can participate, but distance and arrival quality need closer monitoring.',
      operatorAction: `${liveContext} Monitor ignored marketplace alerts and late arrivals by city.`,
      alignedAction:
        'Radius is at the default operating range; keep reviewing city density before making it dynamic.',
      className: narrower ? 'ops-task-blocked' : 'ops-task-pending',
      pillClass: narrower ? 'pill-danger' : 'pill-warn',
    };
  }

  if (
    policyKeyMatches(setting.key, [
      OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
    ])
  ) {
    const looser =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: looser ? 'Allows older locations' : 'Stricter freshness',
      detail: looser
        ? 'Marketplace alerts may reach partners whose last known location is no longer reliable.'
        : 'Only recently refreshed partner locations are eligible for marketplace alerts and participation.',
      operatorAction: `${liveContext} Check partner app location refresh failures before loosening this.`,
      alignedAction:
        'Freshness is at the 30-minute baseline; this fits the 10-minute periodic location update rule.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === OPERATIONAL_POLICY_KEYS.preferredAcceptMode) {
    return {
      status: value === 'AUTO_MATCH_ON_ACCEPT' ? 'Historical value ignored' : 'First-pick priority',
      detail:
        value === 'AUTO_MATCH_ON_ACCEPT'
          ? 'The API now ignores this historical value and uses first-pick priority with customer fallback instead.'
          : 'First-pick priority is required: the first-pick Partner can match first, otherwise customer fallback choice remains available.',
      operatorAction: 'Keep first-pick priority active before scaling marketplace partner shortlist UX.',
      alignedAction:
        'First-pick priority with customer fallback is aligned with the intended direct + marketplace matching model.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (
    policyKeyMatches(setting.key, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ])
  ) {
    return {
      status: value === 'IMMEDIATE_WITHIN_WINDOW' ? 'Immediate marketplace' : 'Delayed marketplace',
      detail:
        value === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'This reduces empty waiting screens and lets nearby partners show interest early.'
          : 'This protects the first-pick Partner window, but marketplace Partners now open immediately when the first-pick Partner declines.',
      operatorAction: `${liveContext} If delayed mode is kept, support should watch waiting-screen complaints.`,
      alignedAction:
        'Immediate marketplace participation supports lower customer anxiety during the first window.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === OPERATIONAL_POLICY_KEYS.walletNegativeGate) {
    const blocksMarketplace = adminWalletGateBlocksMarketplaceParticipation(value);
    return {
      status: blocksMarketplace ? 'Marketplace hold' : 'Historical setting review',
      detail: blocksMarketplace
        ? 'Cash-debt exposure is contained at final acceptance, service start, and payout release gates.'
        : 'Historical exception mode is retained for audit only. The MVP still blocks final acceptance, service start, and payout release until settlement.',
      operatorAction:
        'Keep marketplace list visibility open; use settlement evidence before final acceptance, service start, or payout release.',
      alignedAction: 'Marketplace settlement control matches the HANDS MVP authority rule.',
      className: blocksMarketplace ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: blocksMarketplace ? 'pill-success' : 'pill-danger',
    };
  }

  if (setting.key === 'booking.distance_gate_enabled') {
    return {
      status: value === 'true' ? 'Distance protected' : 'Distance disabled',
      detail:
        value === 'true'
          ? 'Booking create keeps address, customer GPS, and preferred partner distance gates active.'
          : 'Booking create can bypass distance gates. Keep this only for internal tests.',
      operatorAction:
        'Review blocked create attempts before changing this because customers can browse globally while booking remains local.',
      alignedAction: 'Distance gates are active before payment authorization and matching.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: value === recommended ? 'pill-success' : 'pill-danger',
    };
  }

  if (setting.key === 'booking.service_area_required') {
    return {
      status: value === 'true' ? 'Service area required' : 'Service area bypass',
      detail:
        'This controls whether selected booking addresses must be inside enabled Vietnam operating areas.',
      operatorAction:
        'Use setup and blocked-create evidence before relaxing this during city launch configuration.',
      alignedAction: 'Immediate booking stays inside configured HANDS service areas.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === OPERATIONAL_POLICY_KEYS.bookingMaxCustomerCurrentToAddressKm) {
    const looser =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: looser ? 'Wide optional GPS evidence range' : 'Baseline optional GPS evidence range',
      detail:
        'This records the optional customer GPS evidence threshold. Booking creation authority is the confirmed service address snapshot.',
      operatorAction:
        'Review optional customer GPS rows only as support context. Keep booking decisions tied to the immutable address snapshot.',
      alignedAction:
        'Customer GPS evidence is optional while global browsing and address-based booking stay open.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === OPERATIONAL_POLICY_KEYS.bookingMaxPreferredPartnerDistanceKm) {
    const wider =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: wider ? 'Wide first-pick gate' : 'Strict first-pick gate',
      detail:
        'This controls how far the selected first-pick Partner can be from the booking address before payment opens.',
      operatorAction:
        'Check Partner location coverage and rejected first-pick distance logs before widening this.',
      alignedAction: 'First-pick partner distance matches the 50 km baseline for local direct booking.',
      className: wider ? 'ops-task-pending' : 'ops-task-done',
      pillClass: wider ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes) {
    const looser =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: looser ? 'Keeps older optional GPS evidence' : 'Optional GPS evidence baseline',
      detail:
        'This controls how recent optional customer GPS evidence is retained when the app can provide it.',
      operatorAction:
        'Verify address search and optional current-location capture before changing evidence freshness.',
      alignedAction: 'Optional customer GPS evidence matches the 10 minute support-evidence baseline.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  return {
    status: setting.enforced ? 'Owner choice' : 'Planning choice',
    detail: 'This differs from the recommended baseline and should stay visible in weekly operations review.',
    operatorAction: setting.enforced
      ? `${context.activeBookingCount} active booking(s) may need operator awareness.`
      : 'This is not enforced yet; keep the decision documented before automation.',
    alignedAction: 'Current value matches the recommended policy posture.',
    className: setting.enforced ? 'ops-task-pending' : 'ops-task-done',
    pillClass: setting.enforced ? 'pill-warn' : 'pill-info',
  };
}

function policyKeyMatches(key: string, candidates: string[]) {
  return candidates.includes(key);
}
