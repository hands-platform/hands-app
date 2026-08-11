import { ConfigService } from '@nestjs/config';

export { haversineMeters, roundTo100Meters, safeDistanceMeters } from './matching.distance';

export const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;
export const DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES = 10;
export const DEFAULT_BACKUP_PROVIDER_RADIUS_METERS = 10000;
export const DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES = 90;
export const DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT = 50;
export const DEFAULT_BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM = 50;
export const DEFAULT_BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM = 50;
export const DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES = 15;

export const MATCHING_TRAVEL_BUFFER_MINUTES_KEY = 'matching.travel_buffer_minutes';
export const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';
export const MATCHING_MARKETPLACE_PARTNER_RADIUS_METERS_KEY = 'matching.marketplace_partner_radius_meters';
export const MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY =
  'matching.marketplace_partner_location_max_age_minutes';
export const MATCHING_MARKETPLACE_PARTNER_INVITATION_LIMIT_KEY =
  'matching.marketplace_partner_invitation_limit';
export const MATCHING_MARKETPLACE_OPEN_MODE_KEY = 'matching.marketplace_open_mode';
// Product and Admin copy must present this flow as marketplace partner participation.
// Compatibility: these saved policy keys keep the older internal "backup" naming.
// Authority markers: Marketplace partner radius / Marketplace partner location freshness /
// Marketplace partner invitation limit / When marketplace partners can participate.
export const MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY = 'matching.backup_provider_radius_meters';
export const MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY =
  'matching.backup_provider_location_max_age_minutes';
export const MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY = 'matching.backup_provider_invitation_limit';
export const BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM_KEY =
  'booking.max_customer_current_to_booking_address_km';
export const BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM_KEY = 'booking.max_preferred_partner_distance_km';
export const BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES_KEY = 'booking.current_location_freshness_minutes';
export const BOOKING_DISTANCE_GATE_ENABLED_KEY = 'booking.distance_gate_enabled';
export const BOOKING_SERVICE_AREA_REQUIRED_KEY = 'booking.service_area_required';
export const MATCHING_PREFERRED_ACCEPT_MODE_KEY = 'matching.preferred_accept_mode';
// Visible operations language must call it marketplace open mode.
// Compatibility: existing settings store this key as backup_open_mode.
export const MATCHING_BACKUP_OPEN_MODE_KEY = 'matching.backup_open_mode';
export const BACKUP_OPEN_IMMEDIATE = 'IMMEDIATE_WITHIN_WINDOW';
export const BACKUP_OPEN_AFTER_FIRST_PICK_DELAY = 'AFTER_FIRST_PICK_DELAY';
export const CANCELLATION_AFTER_MATCH_POLICY_KEY = 'cancellation.after_match_policy';
export const CANCELLATION_ADMIN_REVIEW_FOR_MVP = 'ADMIN_REVIEW_FOR_MVP';
export const CANCELLATION_ADMIN_FEE_REVIEW_AFTER_MATCH = 'ADMIN_FEE_REVIEW_AFTER_MATCH';
export const NO_SHOW_PARTNER_REPORT_POLICY_KEY = 'no_show.partner_report_policy';
export const NO_SHOW_ADMIN_REVIEW_REQUIRED = 'ADMIN_REVIEW_REQUIRED';
export const NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW = 'EVIDENCE_ASSISTED_ADMIN_REVIEW';
export const NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY = 'notification.partner_alert_channel';
export const PARTNER_ALERT_IN_APP_WITH_PUSH_LATER = 'IN_APP_WITH_PUSH_LATER';
export const PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS = 'FCM_FOR_ALL_BOOKINGS';
// Deprecated persisted value only. HANDS MVP supports FCM, not OneSignal.
export const PARTNER_ALERT_LEGACY_ONESIGNAL_FOR_ALL_BOOKINGS = 'ONESIGNAL_FOR_ALL_BOOKINGS';
export const WALLET_NEGATIVE_BALANCE_GATE_KEY = 'wallet.negative_balance_gate';
export const WALLET_BLOCK_MARKETPLACE_PARTICIPATION = 'BLOCK_MARKETPLACE_PARTICIPATION';
// Compatibility: older saved policy rows may keep the earlier "accepts" wording.
export const WALLET_LEGACY_BLOCK_ACCEPTS_WHEN_NEGATIVE = 'BLOCK_ACCEPTS_WHEN_NEGATIVE';
export const WALLET_ALLOW_ONE_RECOVERY_BOOKING = 'ALLOW_ONE_RECOVERY_BOOKING';
export const DECISION_ACTION_EVIDENCE_GATE_MODE_KEY = 'decision.action_evidence_gate_mode';
export const ACTION_EVIDENCE_ADMIN_REVIEW = 'ADMIN_EVIDENCE_REVIEW';
export const ACTION_EVIDENCE_STRICT_REQUIRED = 'STRICT_EVIDENCE_REQUIRED';
export const CASH_SETTLEMENT_CLEARANCE_POLICY_KEY = 'cash.settlement_clearance_policy';
export const CASH_CLEAR_DEPOSIT_OR_OFFSET_REQUIRED = 'DEPOSIT_OR_ADMIN_OFFSET_REQUIRED';
export const CASH_CLEAR_ADMIN_OFFSET_ONLY = 'ADMIN_OFFSET_ONLY';
export const CASH_CLEAR_DEPOSIT_REFERENCE_REQUIRED = 'DEPOSIT_REFERENCE_REQUIRED';
export const PAYOUT_BATCH_CYCLE_POLICY_KEY = 'payout.batch_cycle_policy';
export const PAYOUT_BATCH_WEEKLY_OR_MONTHLY = 'WEEKLY_OR_MONTHLY_BATCH';
export const PAYOUT_BATCH_ADMIN_SELECTED_DAY = 'ADMIN_SELECTED_DAY_BATCH';
export const PAYOUT_BATCH_HYBRID_REVIEW = 'HYBRID_ADMIN_REVIEW';
export const MATCHING_FIRST_PICK_EXPIRY_ACTION_POLICY_KEY = 'matching.first_pick_expiry_action_policy';
export const FIRST_PICK_OPEN_MARKETPLACE_REVIEW = 'OPEN_MARKETPLACE_AND_OPERATOR_REVIEW';
export const FIRST_PICK_EXPIRE_ONLY_AFTER_REVIEW = 'EXPIRE_ONLY_AFTER_OPERATOR_REVIEW';
export const NO_SHOW_EVIDENCE_REQUIREMENT_POLICY_KEY = 'no_show.evidence_requirement_policy';
export const NO_SHOW_CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED = 'CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED';
export const NO_SHOW_CHAT_AND_OPERATOR_NOTE_REQUIRED = 'CHAT_AND_OPERATOR_NOTE_REQUIRED';
export const NO_SHOW_ADMIN_NOTE_ONLY = 'ADMIN_NOTE_ONLY';
// Kept under the old export name so existing imports continue to compile.
// Customer final choice applies only to marketplace participants.
export const PREFERRED_ACCEPT_CUSTOMER_CONFIRM = 'FIRST_PICK_MATCHES_ON_ACCEPT';
export const START_SHIFT_ACTION_SLA_POLICY_KEYS = {
  cancellationReview: 'command.start_shift.cancellation_review_sla_minutes',
  cashReconciliation: 'command.start_shift.cash_reconciliation_sla_minutes',
  matchingDelays: 'command.start_shift.matching_delays_sla_minutes',
  notificationFailures: 'command.start_shift.notification_failures_sla_minutes',
  partnerApprovals: 'command.start_shift.partner_approvals_sla_minutes',
  paymentHolds: 'command.start_shift.payment_holds_sla_minutes',
  refundReview: 'command.start_shift.refund_review_sla_minutes',
} as const;
export const DEFAULT_START_SHIFT_ACTION_SLA_MINUTES = {
  cancellationReview: 120,
  cashReconciliation: 1_440,
  matchingDelays: 15,
  notificationFailures: 60,
  partnerApprovals: 1_440,
  paymentHolds: 60,
  refundReview: 240,
} as const;
// Authority markers: First-pick partner acceptance can match first under API rules.
// No policy can automatically assign the final partner.
export const MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST = 'FIRST_PICK_ACCEPTED_FIRST';
export const MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER = 'CUSTOMER_SELECTED_PARTNER';

export type PreferredAcceptMode = typeof PREFERRED_ACCEPT_CUSTOMER_CONFIRM;
export type BookingMatchSource =
  | typeof MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER
  | typeof MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST;

export type MatchingPolicy = {
  travelBufferMinutes: number;
  providerResponseWindowMinutes: number;
  backupProviderRadiusMeters: number;
  backupProviderLocationMaxAgeMinutes: number;
  backupProviderInvitationLimit: number;
  bookingMaxCustomerCurrentToAddressKm: number;
  bookingMaxPreferredProviderDistanceKm: number;
  bookingCurrentLocationFreshnessMinutes: number;
  bookingDistanceGateEnabled: boolean;
  bookingServiceAreaRequired: boolean;
  preferredAcceptMode: PreferredAcceptMode;
  backupOpenMode: typeof BACKUP_OPEN_IMMEDIATE | typeof BACKUP_OPEN_AFTER_FIRST_PICK_DELAY;
};

export type OperationalPolicyDefinition = {
  key: string;
  category: string;
  label: string;
  description: string;
  value: number | string | boolean;
  recommendedValue: number | string | boolean;
  unit?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string; tradeoff: string }>;
  requiresRestart?: boolean;
  enforced: boolean;
};

export const OPERATIONAL_POLICY_DEFINITIONS: OperationalPolicyDefinition[] = [
  {
    key: START_SHIFT_ACTION_SLA_POLICY_KEYS.matchingDelays,
    category: 'Command center',
    label: 'Matching delay review SLA',
    description: 'Minutes before an unresolved matching delay is promoted to overdue on Start Shift.',
    value: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.matchingDelays,
    recommendedValue: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.matchingDelays,
    unit: 'minutes',
    min: 5,
    max: 240,
    enforced: true,
  },
  {
    key: START_SHIFT_ACTION_SLA_POLICY_KEYS.paymentHolds,
    category: 'Command center',
    label: 'Payment hold review SLA',
    description: 'Minutes before an authorized payment hold is promoted to overdue on Start Shift.',
    value: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.paymentHolds,
    recommendedValue: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.paymentHolds,
    unit: 'minutes',
    min: 15,
    max: 1_440,
    enforced: true,
  },
  {
    key: START_SHIFT_ACTION_SLA_POLICY_KEYS.cancellationReview,
    category: 'Command center',
    label: 'Cancellation review SLA',
    description: 'Minutes before an unresolved post-match cancellation is promoted to overdue on Start Shift.',
    value: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.cancellationReview,
    recommendedValue: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.cancellationReview,
    unit: 'minutes',
    min: 15,
    max: 1_440,
    enforced: true,
  },
  {
    key: START_SHIFT_ACTION_SLA_POLICY_KEYS.refundReview,
    category: 'Command center',
    label: 'Refund review SLA',
    description: 'Minutes before an open refund request is promoted to overdue on Start Shift.',
    value: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.refundReview,
    recommendedValue: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.refundReview,
    unit: 'minutes',
    min: 30,
    max: 2_880,
    enforced: true,
  },
  {
    key: START_SHIFT_ACTION_SLA_POLICY_KEYS.notificationFailures,
    category: 'Command center',
    label: 'Notification failure review SLA',
    description: 'Minutes before an unresolved notification delivery failure is promoted to overdue on Start Shift.',
    value: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.notificationFailures,
    recommendedValue: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.notificationFailures,
    unit: 'minutes',
    min: 15,
    max: 1_440,
    enforced: true,
  },
  {
    key: START_SHIFT_ACTION_SLA_POLICY_KEYS.cashReconciliation,
    category: 'Command center',
    label: 'Cash reconciliation SLA',
    description: 'Minutes before an open cash-booking debt is promoted to overdue on Start Shift.',
    value: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.cashReconciliation,
    recommendedValue: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.cashReconciliation,
    unit: 'minutes',
    min: 60,
    max: 10_080,
    enforced: true,
  },
  {
    key: START_SHIFT_ACTION_SLA_POLICY_KEYS.partnerApprovals,
    category: 'Command center',
    label: 'Partner approval SLA',
    description: 'Minutes before a submitted Partner review is promoted to overdue on Start Shift.',
    value: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.partnerApprovals,
    recommendedValue: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.partnerApprovals,
    unit: 'minutes',
    min: 60,
    max: 10_080,
    enforced: true,
  },
  {
    key: MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY,
    category: 'Matching',
    label: 'First-pick Partner response window',
    description:
      'Minutes the first-pick Partner has to accept before marketplace participation becomes more visible.',
    value: DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
    recommendedValue: DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
    unit: 'minutes',
    min: 3,
    max: 30,
    enforced: true,
  },
  {
    key: MATCHING_MARKETPLACE_PARTNER_RADIUS_METERS_KEY,
    category: 'Matching',
    label: 'Marketplace Partner radius',
    description:
      'Maximum distance from the confirmed booking address for marketplace Partners that can see and participate in an open request.',
    value: DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
    recommendedValue: DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
    unit: 'meters',
    min: 1000,
    max: 30000,
    enforced: true,
  },
  {
    key: MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY,
    category: 'Matching',
    label: 'Marketplace Partner location freshness',
    description:
      'Maximum age of a Partner location before they are excluded from marketplace participation alerts.',
    value: DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
    recommendedValue: DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
    unit: 'minutes',
    min: 5,
    max: 1440,
    enforced: true,
  },
  {
    key: MATCHING_MARKETPLACE_PARTNER_INVITATION_LIMIT_KEY,
    category: 'Matching',
    label: 'Marketplace Partner invitation limit',
    description:
      'Maximum number of nearby eligible marketplace Partners that can be exposed to the request and notified for participation.',
    value: DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
    recommendedValue: DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
    unit: 'partners',
    min: 1,
    max: 200,
    enforced: true,
  },
  {
    key: MATCHING_TRAVEL_BUFFER_MINUTES_KEY,
    category: 'Matching',
    label: 'Travel buffer after a booking',
    description: 'Buffer minutes after the current booking before a Partner is considered available again.',
    value: DEFAULT_TRAVEL_BUFFER_MINUTES,
    recommendedValue: DEFAULT_TRAVEL_BUFFER_MINUTES,
    unit: 'minutes',
    min: 0,
    max: 120,
    enforced: true,
  },
  {
    key: BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM_KEY,
    category: 'Booking',
    label: 'Customer current-to-service address gate',
    description:
      'When fresh customer GPS is available, booking creation is blocked if the selected service address is this far or farther from the customer current location.',
    value: DEFAULT_BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM,
    recommendedValue: DEFAULT_BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM,
    unit: 'km',
    min: 1,
    max: 100,
    enforced: true,
  },
  {
    key: BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM_KEY,
    category: 'Booking',
    label: 'First-pick Partner-to-service address gate',
    description:
      'Maximum allowed distance between the preferred Partner last saved location and the booking address.',
    value: DEFAULT_BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM,
    recommendedValue: DEFAULT_BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM,
    unit: 'km',
    min: 1,
    max: 300,
    enforced: true,
  },
  {
    key: BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES_KEY,
    category: 'Booking',
    label: 'Customer current location evidence freshness',
    description:
      'Maximum age of the optional customer current GPS snapshot stored as booking evidence when the app can provide it.',
    value: DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES,
    recommendedValue: DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES,
    unit: 'minutes',
    min: 1,
    max: 60,
    enforced: true,
  },
  {
    key: BOOKING_DISTANCE_GATE_ENABLED_KEY,
    category: 'Booking',
    label: 'Booking distance gate',
    description:
      'When enabled, preferred first-pick Partner distance is checked against the booking address. Customer GPS stays optional evidence.',
    value: true,
    recommendedValue: true,
    enforced: true,
  },
  {
    key: BOOKING_SERVICE_AREA_REQUIRED_KEY,
    category: 'Booking',
    label: 'Vietnam service area required',
    description: 'When enabled, booking address snapshots must be inside the enabled Vietnam service area.',
    value: true,
    recommendedValue: true,
    enforced: true,
  },
  {
    key: MATCHING_PREFERRED_ACCEPT_MODE_KEY,
    category: 'Decision',
    label: 'First-pick acceptance contract',
    description:
      'First-pick Partner acceptance can match first under API rules; otherwise the customer selects from participating Partners.',
    value: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    recommendedValue: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    options: [
      {
        value: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
        label: 'First-pick priority with customer fallback',
        tradeoff:
          'Required HANDS MVP contract. Customer final selection is required unless first-pick validly accepts first.',
      },
    ],
    enforced: true,
  },
  {
    key: MATCHING_MARKETPLACE_OPEN_MODE_KEY,
    category: 'Decision',
    label: 'When marketplace Partners can participate',
    description:
      'Marketplace Partners can participate during the first-pick response window. Legacy delayed values are accepted for compatibility and normalized to immediate participation.',
    value: BACKUP_OPEN_IMMEDIATE,
    recommendedValue: BACKUP_OPEN_IMMEDIATE,
    options: [
      {
        value: BACKUP_OPEN_IMMEDIATE,
        label: 'Open marketplace immediately',
        tradeoff: 'Reduces customer waiting anxiety and creates visible alternatives.',
      },
      {
        value: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
        label: 'Legacy delayed value',
        tradeoff:
          'Deprecated compatibility value for old policy rows only. HANDS MVP normalizes it to immediate marketplace participation.',
      },
    ],
    enforced: true,
  },
  {
    key: WALLET_NEGATIVE_BALANCE_GATE_KEY,
    category: 'Decision',
    label: 'Negative wallet final gate',
    description:
      'Controls how unpaid cash-service platform fees block final acceptance, service start, and payout release.',
    value: WALLET_BLOCK_MARKETPLACE_PARTICIPATION,
    recommendedValue: WALLET_BLOCK_MARKETPLACE_PARTICIPATION,
    options: [
      {
        value: WALLET_BLOCK_MARKETPLACE_PARTICIPATION,
        label: 'Hold final acceptance while negative',
        tradeoff:
          'Keeps marketplace requests visible for review, but blocks final acceptance, service start, and payout release while debt is open.',
      },
      {
        value: WALLET_ALLOW_ONE_RECOVERY_BOOKING,
        label: 'Historical exception disabled',
        tradeoff:
          'Compatibility value for old policy rows only. HANDS MVP blocks final acceptance, service start, and payout release while the wallet is negative.',
      },
    ],
    enforced: true,
  },
  {
    key: DECISION_ACTION_EVIDENCE_GATE_MODE_KEY,
    category: 'Decision',
    label: 'Booking action evidence gate',
    description:
      'Controls the evidence posture operators should use before capture, release, cash-fee settlement, expiry, no-show, or closeout actions.',
    value: ACTION_EVIDENCE_ADMIN_REVIEW,
    recommendedValue: ACTION_EVIDENCE_ADMIN_REVIEW,
    options: [
      {
        value: ACTION_EVIDENCE_ADMIN_REVIEW,
        label: 'Admin evidence review',
        tradeoff:
          'Best MVP posture. Operators review retained payment, chat, address, wallet, and audit evidence before manual actions.',
      },
      {
        value: ACTION_EVIDENCE_STRICT_REQUIRED,
        label: 'Strict evidence required',
        tradeoff:
          'Safer for scale, but should wait until every mobile and admin evidence upload path is mature.',
      },
    ],
    enforced: true,
  },
  {
    key: CASH_SETTLEMENT_CLEARANCE_POLICY_KEY,
    category: 'Decision',
    label: 'Cash fee settlement clearance',
    description:
      'Controls what operators need before clearing a negative wallet caused by cash-service platform fees.',
    value: CASH_CLEAR_DEPOSIT_OR_OFFSET_REQUIRED,
    recommendedValue: CASH_CLEAR_DEPOSIT_OR_OFFSET_REQUIRED,
    options: [
      {
        value: CASH_CLEAR_DEPOSIT_OR_OFFSET_REQUIRED,
        label: 'Deposit or admin offset required',
        tradeoff:
          'Allows either verified company deposit or approved offset from future settlement while keeping evidence attached.',
      },
      {
        value: CASH_CLEAR_ADMIN_OFFSET_ONLY,
        label: 'Admin offset only',
        tradeoff:
          'Simpler for operators, but keeps company cash repayment slower when partners deposit directly.',
      },
      {
        value: CASH_CLEAR_DEPOSIT_REFERENCE_REQUIRED,
        label: 'Deposit reference required',
        tradeoff:
          'Strongest cash evidence, but creates more manual support when partners cannot upload clean references.',
      },
    ],
    enforced: true,
  },
  {
    key: PAYOUT_BATCH_CYCLE_POLICY_KEY,
    category: 'Decision',
    label: 'Payout batch cycle',
    description:
      'Controls how positive Partner earnings are grouped for settlement. Payout remains batch-based and admin-controlled, never paid instantly from a single booking.',
    value: PAYOUT_BATCH_WEEKLY_OR_MONTHLY,
    recommendedValue: PAYOUT_BATCH_WEEKLY_OR_MONTHLY,
    options: [
      {
        value: PAYOUT_BATCH_WEEKLY_OR_MONTHLY,
        label: 'Weekly or monthly batch',
        tradeoff:
          'Best MVP posture. Keeps settlement predictable while operators choose weekly or monthly payout runs.',
      },
      {
        value: PAYOUT_BATCH_ADMIN_SELECTED_DAY,
        label: 'Admin selected day',
        tradeoff:
          'Useful for special payout days, but requires careful operator checklist and transfer references.',
      },
      {
        value: PAYOUT_BATCH_HYBRID_REVIEW,
        label: 'Hybrid admin review',
        tradeoff: 'Allows manual exception batches while preserving the default scheduled payout rhythm.',
      },
    ],
    enforced: true,
  },
  {
    key: MATCHING_FIRST_PICK_EXPIRY_ACTION_POLICY_KEY,
    category: 'Decision',
    label: 'First-pick expiry handling',
    description:
      'Controls the operator posture when the first-pick Partner response window passes. No policy can automatically assign the final Partner.',
    value: FIRST_PICK_OPEN_MARKETPLACE_REVIEW,
    recommendedValue: FIRST_PICK_OPEN_MARKETPLACE_REVIEW,
    options: [
      {
        value: FIRST_PICK_OPEN_MARKETPLACE_REVIEW,
        label: 'Open marketplace and review',
        tradeoff:
          'Keeps the customer choice model alive by exposing nearby alternatives while operators monitor overdue requests.',
      },
      {
        value: FIRST_PICK_EXPIRE_ONLY_AFTER_REVIEW,
        label: 'Expire only after review',
        tradeoff: 'More conservative, but can increase customer waiting when nearby partners are available.',
      },
    ],
    enforced: true,
  },
  {
    key: CANCELLATION_AFTER_MATCH_POLICY_KEY,
    category: 'Decision',
    label: 'Customer cancellation after match',
    description:
      'Choose how HANDS should handle customer cancellation after a partner has accepted or been selected.',
    value: CANCELLATION_ADMIN_REVIEW_FOR_MVP,
    recommendedValue: CANCELLATION_ADMIN_REVIEW_FOR_MVP,
    options: [
      {
        value: CANCELLATION_ADMIN_REVIEW_FOR_MVP,
        label: 'Admin review for MVP',
        tradeoff: 'Safest while operations learn real cancellation reasons and edge cases.',
      },
      {
        value: CANCELLATION_ADMIN_FEE_REVIEW_AFTER_MATCH,
        label: 'Admin fee review after match',
        tradeoff:
          'Protects partner time without automatic closeout decisions; operators review chat, arrival, and refund context.',
      },
    ],
    enforced: true,
  },
  {
    key: NO_SHOW_PARTNER_REPORT_POLICY_KEY,
    category: 'Decision',
    label: 'No-show handling',
    description: 'Choose how no-show reports should move from partner report to operational decision.',
    value: NO_SHOW_ADMIN_REVIEW_REQUIRED,
    recommendedValue: NO_SHOW_ADMIN_REVIEW_REQUIRED,
    options: [
      {
        value: NO_SHOW_ADMIN_REVIEW_REQUIRED,
        label: 'Admin review required',
        tradeoff: 'Reduces incorrect automatic decisions while the marketplace is young.',
      },
      {
        value: NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW,
        label: 'Evidence-assisted admin review',
        tradeoff:
          'Keeps the final decision in Admin while requiring stronger chat, alert, location, or note evidence.',
      },
    ],
    enforced: true,
  },
  {
    key: NO_SHOW_EVIDENCE_REQUIREMENT_POLICY_KEY,
    category: 'Decision',
    label: 'No-show evidence requirement',
    description:
      'Defines the minimum retained evidence operators should review before closing a booking as no-show.',
    value: NO_SHOW_CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED,
    recommendedValue: NO_SHOW_CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED,
    options: [
      {
        value: NO_SHOW_CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED,
        label: 'Chat, alert, location, or note required',
        tradeoff:
          'Balanced MVP standard that keeps the decision factual without requiring every evidence source at once.',
      },
      {
        value: NO_SHOW_CHAT_AND_OPERATOR_NOTE_REQUIRED,
        label: 'Chat and operator note required',
        tradeoff: 'Stronger internal review, but can slow closeout when chat is missing or archived late.',
      },
      {
        value: NO_SHOW_ADMIN_NOTE_ONLY,
        label: 'Admin note only',
        tradeoff: 'Fastest manual handling, but weak for disputes unless paired with strong audit habits.',
      },
    ],
    enforced: true,
  },
  {
    key: NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
    category: 'Decision',
    label: 'Partner alert routing',
    description: 'Choose how partners should receive urgent booking and marketplace participation alerts.',
    value: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
    recommendedValue: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
    options: [
      {
        value: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
        label: 'In-app now, FCM push later',
        tradeoff: 'Keeps MVP stable until FCM credentials and mobile app config are ready for FCM push E2E.',
      },
      {
        value: PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS,
        label: 'FCM for all bookings',
        tradeoff: 'Better reach, but depends on Firebase Admin credentials and delivery monitoring.',
      },
    ],
    enforced: true,
  },
];

export function isFcmPartnerAlertChannel(value: unknown): boolean {
  return (
    value === PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS || value === PARTNER_ALERT_LEGACY_ONESIGNAL_FOR_ALL_BOOKINGS
  );
}

export function resolveMatchingPolicy(
  config: ConfigService,
  settings: Record<string, unknown> = {},
): MatchingPolicy {
  return {
    travelBufferMinutes: readPolicyInteger(
      settings[MATCHING_TRAVEL_BUFFER_MINUTES_KEY],
      readPositiveInteger(config, 'MATCHING_TRAVEL_BUFFER_MINUTES', DEFAULT_TRAVEL_BUFFER_MINUTES),
      0,
      120,
    ),
    providerResponseWindowMinutes: readPolicyInteger(
      settings[MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY],
      readPositiveInteger(
        config,
        'MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES',
        DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
      ),
      3,
      30,
    ),
    backupProviderRadiusMeters: readPolicyInteger(
      readFirstPolicyValue(settings, [
        MATCHING_MARKETPLACE_PARTNER_RADIUS_METERS_KEY,
        MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY,
      ]),
      readPositiveIntegerFromConfig(
        config,
        ['MATCHING_MARKETPLACE_PARTNER_RADIUS_METERS', 'MATCHING_BACKUP_PROVIDER_RADIUS_METERS'],
        DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
      ),
      1000,
      30000,
    ),
    backupProviderLocationMaxAgeMinutes: readPolicyInteger(
      readFirstPolicyValue(settings, [
        MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY,
        MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY,
      ]),
      readPositiveIntegerFromConfig(
        config,
        [
          'MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES',
          'MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES',
        ],
        DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
      ),
      5,
      1440,
    ),
    backupProviderInvitationLimit: readPolicyInteger(
      readFirstPolicyValue(settings, [
        MATCHING_MARKETPLACE_PARTNER_INVITATION_LIMIT_KEY,
        MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY,
      ]),
      readPositiveIntegerFromConfig(
        config,
        ['MATCHING_MARKETPLACE_PARTNER_INVITATION_LIMIT', 'MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT'],
        DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
      ),
      1,
      200,
    ),
    bookingMaxCustomerCurrentToAddressKm: readPolicyInteger(
      settings[BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM_KEY],
      readPositiveInteger(
        config,
        'BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM',
        DEFAULT_BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM,
      ),
      1,
      100,
    ),
    bookingMaxPreferredProviderDistanceKm: readPolicyInteger(
      settings[BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM_KEY],
      readPositiveInteger(
        config,
        'BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM',
        DEFAULT_BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM,
      ),
      1,
      300,
    ),
    bookingCurrentLocationFreshnessMinutes: readPolicyInteger(
      settings[BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES_KEY],
      readPositiveInteger(
        config,
        'BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES',
        DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES,
      ),
      1,
      60,
    ),
    bookingDistanceGateEnabled: readPolicyBoolean(settings[BOOKING_DISTANCE_GATE_ENABLED_KEY], true),
    bookingServiceAreaRequired: readPolicyBoolean(settings[BOOKING_SERVICE_AREA_REQUIRED_KEY], true),
    preferredAcceptMode: readPreferredAcceptMode(settings[MATCHING_PREFERRED_ACCEPT_MODE_KEY]),
    backupOpenMode:
      readBackupOpenMode(
        readFirstPolicyValue(settings, [MATCHING_MARKETPLACE_OPEN_MODE_KEY, MATCHING_BACKUP_OPEN_MODE_KEY]),
      ) ?? BACKUP_OPEN_IMMEDIATE,
  };
}

export function resolveMatchingPolicyFromPayload(payload: unknown): MatchingPolicy | undefined {
  if (!payload || typeof payload !== 'object' || !('matchingPolicy' in payload)) {
    return undefined;
  }
  const policy = payload.matchingPolicy;
  if (!policy || typeof policy !== 'object') {
    return undefined;
  }

  const providerResponseWindowMinutes = readSnapshotInteger(
    readPayloadValue(policy, 'preferredProviderResponseWindowMinutes') ??
      readPayloadValue(policy, 'providerResponseWindowMinutes'),
    3,
    30,
  );
  const backupProviderRadiusMeters = readSnapshotInteger(
    readPayloadValue(policy, 'marketplaceRadiusMeters') ??
      readPayloadValue(policy, 'marketplacePartnerRadiusMeters') ??
      readPayloadValue(policy, 'backupProviderRadiusMeters'),
    1000,
    30000,
  );
  const travelBufferMinutes = readSnapshotInteger(readPayloadValue(policy, 'travelBufferMinutes'), 0, 120);
  const backupProviderLocationMaxAgeMinutes = readSnapshotInteger(
    readPayloadValue(policy, 'marketplaceLocationMaxAgeMinutes') ??
      readPayloadValue(policy, 'marketplacePartnerLocationMaxAgeMinutes') ??
      readPayloadValue(policy, 'backupProviderLocationMaxAgeMinutes'),
    5,
    1440,
  );
  const backupProviderInvitationLimit = readSnapshotInteger(
    readPayloadValue(policy, 'marketplaceInvitationLimit') ??
      readPayloadValue(policy, 'marketplacePartnerInvitationLimit') ??
      readPayloadValue(policy, 'backupProviderInvitationLimit'),
    1,
    200,
  );
  const preferredAcceptMode = readPreferredAcceptMode(readPayloadValue(policy, 'preferredAcceptMode'));
  const backupOpenMode = readBackupOpenMode(
    readPayloadValue(policy, 'marketplaceOpenMode') ?? readPayloadValue(policy, 'backupOpenMode'),
  );

  if (
    providerResponseWindowMinutes == null ||
    backupProviderRadiusMeters == null ||
    travelBufferMinutes == null ||
    backupProviderLocationMaxAgeMinutes == null ||
    backupProviderInvitationLimit == null ||
    preferredAcceptMode == null ||
    backupOpenMode == null
  ) {
    return undefined;
  }

  return {
    providerResponseWindowMinutes,
    backupProviderRadiusMeters,
    backupProviderLocationMaxAgeMinutes,
    backupProviderInvitationLimit,
    bookingMaxCustomerCurrentToAddressKm:
      readSnapshotInteger(readPayloadValue(policy, 'bookingMaxCustomerCurrentToAddressKm'), 1, 100) ??
      DEFAULT_BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM,
    bookingMaxPreferredProviderDistanceKm:
      readSnapshotInteger(readPayloadValue(policy, 'bookingMaxPreferredProviderDistanceKm'), 1, 300) ??
      DEFAULT_BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM,
    bookingCurrentLocationFreshnessMinutes:
      readSnapshotInteger(readPayloadValue(policy, 'bookingCurrentLocationFreshnessMinutes'), 1, 60) ??
      DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES,
    bookingDistanceGateEnabled: readPayloadBoolean(policy, 'bookingDistanceGateEnabled', true),
    bookingServiceAreaRequired: readPayloadBoolean(policy, 'bookingServiceAreaRequired', true),
    travelBufferMinutes,
    preferredAcceptMode,
    backupOpenMode,
  };
}

function readPositiveInteger(config: ConfigService, key: string, fallback: number) {
  const value = Number(config.get<string>(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readPositiveIntegerFromConfig(config: ConfigService, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = Number(config.get<string>(key));
    if (Number.isInteger(value) && value > 0) {
      return value;
    }
  }
  return fallback;
}

function readFirstPolicyValue(settings: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (settings[key] !== undefined && settings[key] !== null && settings[key] !== '') {
      return settings[key];
    }
  }
  return undefined;
}

export function readPolicyInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function readPolicyBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return fallback;
}

function readPreferredAcceptMode(value: unknown): PreferredAcceptMode {
  void value;
  return PREFERRED_ACCEPT_CUSTOMER_CONFIRM;
}

function readBackupOpenMode(value: unknown) {
  if (value === BACKUP_OPEN_IMMEDIATE) {
    return BACKUP_OPEN_IMMEDIATE;
  }
  if (value === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY) {
    return BACKUP_OPEN_IMMEDIATE;
  }
  return undefined;
}

function readPayloadValue(source: object, key: string) {
  return key in source ? (source as Record<string, unknown>)[key] : undefined;
}

function readPayloadBoolean(source: object, key: string, fallback: boolean) {
  const value = readPayloadValue(source, key);
  return typeof value === 'boolean' ? value : fallback;
}

function readSnapshotInteger(value: unknown, min: number, max: number) {
  if (value == null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}
