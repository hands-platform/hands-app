import { ConfigService } from '@nestjs/config';

export const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;
export const DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES = 10;
export const DEFAULT_BACKUP_PROVIDER_RADIUS_METERS = 10000;
export const DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES = 30;
export const DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT = 50;
export const DEFAULT_BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM = 20;
export const DEFAULT_BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM = 50;
export const DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES = 10;

export const MATCHING_TRAVEL_BUFFER_MINUTES_KEY = 'matching.travel_buffer_minutes';
export const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';
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
export const MATCHING_BACKUP_OPEN_MODE_KEY = 'matching.backup_open_mode';
export const BACKUP_OPEN_IMMEDIATE = 'IMMEDIATE_WITHIN_WINDOW';
export const BACKUP_OPEN_AFTER_FIRST_PICK_DELAY = 'AFTER_FIRST_PICK_DELAY';
export const CANCELLATION_AFTER_MATCH_POLICY_KEY = 'cancellation.after_match_policy';
export const CANCELLATION_ADMIN_REVIEW_FOR_MVP = 'ADMIN_REVIEW_FOR_MVP';
export const CANCELLATION_AUTO_FEE_AFTER_MATCH = 'AUTO_FEE_AFTER_MATCH';
export const NO_SHOW_PARTNER_REPORT_POLICY_KEY = 'no_show.partner_report_policy';
export const NO_SHOW_ADMIN_REVIEW_REQUIRED = 'ADMIN_REVIEW_REQUIRED';
export const NO_SHOW_AUTO_AFTER_EVIDENCE = 'AUTO_NO_SHOW_AFTER_EVIDENCE';
export const NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY = 'notification.partner_alert_channel';
export const PARTNER_ALERT_IN_APP_WITH_PUSH_LATER = 'IN_APP_WITH_PUSH_LATER';
export const PARTNER_ALERT_ONESIGNAL_FOR_ALL_BOOKINGS = 'ONESIGNAL_FOR_ALL_BOOKINGS';
export const WALLET_NEGATIVE_BALANCE_GATE_KEY = 'wallet.negative_balance_gate';
export const WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE = 'BLOCK_ACCEPTS_WHEN_NEGATIVE';
export const WALLET_ALLOW_ONE_RECOVERY_BOOKING = 'ALLOW_ONE_RECOVERY_BOOKING';
export const DECISION_ACTION_EVIDENCE_GATE_MODE_KEY = 'decision.action_evidence_gate_mode';
export const ACTION_EVIDENCE_ADMIN_REVIEW = 'ADMIN_EVIDENCE_REVIEW';
export const ACTION_EVIDENCE_STRICT_REQUIRED = 'STRICT_EVIDENCE_REQUIRED';
export const CASH_SETTLEMENT_CLEARANCE_POLICY_KEY = 'cash.settlement_clearance_policy';
export const CASH_CLEAR_DEPOSIT_OR_OFFSET_REQUIRED = 'DEPOSIT_OR_ADMIN_OFFSET_REQUIRED';
export const CASH_CLEAR_ADMIN_OFFSET_ONLY = 'ADMIN_OFFSET_ONLY';
export const CASH_CLEAR_DEPOSIT_REFERENCE_REQUIRED = 'DEPOSIT_REFERENCE_REQUIRED';
export const MATCHING_FIRST_PICK_EXPIRY_ACTION_POLICY_KEY = 'matching.first_pick_expiry_action_policy';
export const FIRST_PICK_OPEN_MARKETPLACE_REVIEW = 'OPEN_MARKETPLACE_AND_OPERATOR_REVIEW';
export const FIRST_PICK_EXPIRE_ONLY_AFTER_REVIEW = 'EXPIRE_ONLY_AFTER_OPERATOR_REVIEW';
export const NO_SHOW_EVIDENCE_REQUIREMENT_POLICY_KEY = 'no_show.evidence_requirement_policy';
export const NO_SHOW_CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED = 'CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED';
export const NO_SHOW_CHAT_AND_OPERATOR_NOTE_REQUIRED = 'CHAT_AND_OPERATOR_NOTE_REQUIRED';
export const NO_SHOW_ADMIN_NOTE_ONLY = 'ADMIN_NOTE_ONLY';
export const PREFERRED_ACCEPT_CUSTOMER_CONFIRM = 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

export type PreferredAcceptMode = typeof PREFERRED_ACCEPT_CUSTOMER_CONFIRM;

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
    key: MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY,
    category: 'Matching',
    label: 'First-pick partner response window',
    description:
      'Minutes the first-pick partner has to accept before marketplace participation becomes more visible.',
    value: DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
    recommendedValue: DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
    unit: 'minutes',
    min: 3,
    max: 30,
    enforced: true,
  },
  {
    key: MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY,
    category: 'Matching',
    label: 'Marketplace partner radius',
    description:
      'Maximum distance from the customer for nearby partners that can see and join an open request.',
    value: DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
    recommendedValue: DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
    unit: 'meters',
    min: 1000,
    max: 30000,
    enforced: true,
  },
  {
    key: MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY,
    category: 'Matching',
    label: 'Marketplace partner location freshness',
    description:
      'Maximum age of a partner location before they are excluded from marketplace participation alerts.',
    value: DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
    recommendedValue: DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
    unit: 'minutes',
    min: 5,
    max: 1440,
    enforced: true,
  },
  {
    key: MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY,
    category: 'Matching',
    label: 'Marketplace partner invitation limit',
    description:
      'Maximum number of nearby eligible marketplace partners that can be exposed to the request and notified for participation.',
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
    description: 'Buffer minutes after the current booking before a partner is considered available again.',
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
      'Maximum allowed distance between the customer current GPS and the confirmed service address before payment and matching open.',
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
    label: 'First-pick partner-to-service address gate',
    description:
      'Maximum allowed distance between the preferred partner last saved location and the booking address.',
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
    label: 'Customer current location freshness',
    description: 'Maximum age of the customer current GPS snapshot accepted at booking confirmation.',
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
      'When enabled, bookings are rejected before payment if customer GPS or first-pick partner distance gates fail.',
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
      'First-pick partner acceptance keeps the booking open until the customer confirms the final partner. Automatic matching is disabled for the MVP.',
    value: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    recommendedValue: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    options: [
      {
        value: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
        label: 'Customer confirms final partner',
        tradeoff: 'Required HANDS MVP contract. The customer always chooses the final partner.',
      },
    ],
    enforced: true,
  },
  {
    key: MATCHING_BACKUP_OPEN_MODE_KEY,
    category: 'Decision',
    label: 'When marketplace partners can join',
    description:
      'Choose whether nearby marketplace partners can join during the first-pick response window, or only after the timer passes. If the first-pick partner declines, marketplace partners open immediately.',
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
        label: 'Delay marketplace visibility',
        tradeoff:
          'Less partner noise while the first-pick partner is deciding, with immediate recovery if that partner declines.',
      },
    ],
    enforced: true,
  },
  {
    key: WALLET_NEGATIVE_BALANCE_GATE_KEY,
    category: 'Decision',
    label: 'Negative wallet booking gate',
    description:
      'Choose which final gates wait for unpaid cash-service platform fees while marketplace visibility stays open.',
    value: WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE,
    recommendedValue: WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE,
    options: [
      {
        value: WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE,
        label: 'Hold final gates while negative',
        tradeoff:
          'Keeps marketplace visibility open, but blocks final acceptance or customer selection while debt is open.',
      },
      {
        value: WALLET_ALLOW_ONE_RECOVERY_BOOKING,
        label: 'Recovery supervision',
        tradeoff:
          'Lets operators supervise configured final-gate exceptions, but leaves unpaid fees open longer.',
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
    key: MATCHING_FIRST_PICK_EXPIRY_ACTION_POLICY_KEY,
    category: 'Decision',
    label: 'First-pick expiry handling',
    description:
      'Controls the operator posture when the first-pick partner response window passes. No policy can automatically assign the final partner.',
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
        value: CANCELLATION_AUTO_FEE_AFTER_MATCH,
        label: 'Auto fee after match',
        tradeoff: 'Protects partner time, but needs clear customer-facing rules and refund handling.',
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
        value: NO_SHOW_AUTO_AFTER_EVIDENCE,
        label: 'Auto no-show after evidence',
        tradeoff: 'Faster operations, but requires strong evidence upload and dispute flows.',
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
    label: 'Partner alert channel',
    description: 'Choose how partners should receive urgent booking and marketplace participation alerts.',
    value: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
    recommendedValue: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
    options: [
      {
        value: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
        label: 'In-app now, push later',
        tradeoff: 'Keeps MVP stable until OneSignal and production SMS accounts are fully approved.',
      },
      {
        value: PARTNER_ALERT_ONESIGNAL_FOR_ALL_BOOKINGS,
        label: 'OneSignal for all bookings',
        tradeoff: 'Better reach, but depends on production push setup and delivery monitoring.',
      },
    ],
    enforced: true,
  },
];

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
      settings[MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY],
      readPositiveInteger(
        config,
        'MATCHING_BACKUP_PROVIDER_RADIUS_METERS',
        DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
      ),
      1000,
      30000,
    ),
    backupProviderLocationMaxAgeMinutes: readPolicyInteger(
      settings[MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY],
      readPositiveInteger(
        config,
        'MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES',
        DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
      ),
      5,
      1440,
    ),
    backupProviderInvitationLimit: readPolicyInteger(
      settings[MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY],
      readPositiveInteger(
        config,
        'MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT',
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
      settings[MATCHING_BACKUP_OPEN_MODE_KEY] === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY
        ? BACKUP_OPEN_AFTER_FIRST_PICK_DELAY
        : BACKUP_OPEN_IMMEDIATE,
  };
}

export function roundTo100Meters(value: number) {
  return Math.round(value / 100) * 100;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readPositiveInteger(config: ConfigService, key: string, fallback: number) {
  const value = Number(config.get<string>(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
