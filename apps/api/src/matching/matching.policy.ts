import { ConfigService } from '@nestjs/config';

export const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;
export const DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES = 10;
export const DEFAULT_BACKUP_PROVIDER_RADIUS_METERS = 10000;
export const DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES = 30;
export const DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT = 50;

export const MATCHING_TRAVEL_BUFFER_MINUTES_KEY = 'matching.travel_buffer_minutes';
export const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';
export const MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY = 'matching.backup_provider_radius_meters';
export const MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY =
  'matching.backup_provider_location_max_age_minutes';
export const MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY =
  'matching.backup_provider_invitation_limit';
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
export const PREFERRED_ACCEPT_AUTO_MATCH = 'AUTO_MATCH_ON_ACCEPT';
export const PREFERRED_ACCEPT_CUSTOMER_CONFIRM = 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

export type PreferredAcceptMode =
  | typeof PREFERRED_ACCEPT_AUTO_MATCH
  | typeof PREFERRED_ACCEPT_CUSTOMER_CONFIRM;

export type MatchingPolicy = {
  travelBufferMinutes: number;
  providerResponseWindowMinutes: number;
  backupProviderRadiusMeters: number;
  backupProviderLocationMaxAgeMinutes: number;
  backupProviderInvitationLimit: number;
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
      'Minutes the first-pick partner has to accept before the request should be treated as at-risk.',
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
    label: 'Backup partner radius',
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
    label: 'Backup partner location freshness',
    description:
      'Maximum age of a partner location before they are excluded from backup participation alerts.',
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
    label: 'Backup partner invitation limit',
    description:
      'Maximum number of nearby eligible backup partners that can be exposed to the request and notified for participation.',
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
    key: MATCHING_PREFERRED_ACCEPT_MODE_KEY,
    category: 'Decision',
    label: 'When the first-pick partner accepts',
    description:
      'Choose whether a first-pick partner acceptance immediately matches the booking or still asks the customer to confirm.',
    value: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    recommendedValue: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    options: [
      {
        value: PREFERRED_ACCEPT_AUTO_MATCH,
        label: 'Auto match on first-pick accept',
        tradeoff: 'Fastest MVP flow, but the customer has less final control.',
      },
      {
        value: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
        label: 'Customer confirms final partner',
        tradeoff: 'Best for long-term customer control, but needs a clearer waiting screen flow.',
      },
    ],
    enforced: true,
  },
  {
    key: MATCHING_BACKUP_OPEN_MODE_KEY,
    category: 'Decision',
    label: 'When backup partners can join',
    description:
      'Choose whether nearby backup partners can join during the first-pick response window, or only after the timer passes. If the first-pick partner declines, backup partners open immediately.',
    value: BACKUP_OPEN_IMMEDIATE,
    recommendedValue: BACKUP_OPEN_IMMEDIATE,
    options: [
      {
        value: BACKUP_OPEN_IMMEDIATE,
        label: 'Open backups immediately',
        tradeoff: 'Reduces customer waiting anxiety and creates visible alternatives.',
      },
      {
        value: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
        label: 'Delay backup visibility',
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
      'Choose how strictly partners with unpaid cash-service platform fees are blocked from accepting new work.',
    value: WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE,
    recommendedValue: WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE,
    options: [
      {
        value: WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE,
        label: 'Block accepts while negative',
        tradeoff: 'Protects company fee collection and blocks new booking participation while debt is open.',
      },
      {
        value: WALLET_ALLOW_ONE_RECOVERY_BOOKING,
        label: 'Allow one recovery booking',
        tradeoff:
          'More partner-friendly by allowing one active recovery booking, but increases unpaid-fee risk.',
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
        tradeoff: 'Reduces false penalties while the marketplace is young.',
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
    key: NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
    category: 'Decision',
    label: 'Partner alert channel',
    description: 'Choose how partners should receive urgent booking and backup participation alerts.',
    value: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
    recommendedValue: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
    options: [
      {
        value: PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
        label: 'In-app now, push later',
        tradeoff: 'Keeps MVP stable until OneSignal/Vonage production accounts are fully approved.',
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

function readPreferredAcceptMode(value: unknown): PreferredAcceptMode {
  return value === PREFERRED_ACCEPT_AUTO_MATCH
    ? PREFERRED_ACCEPT_AUTO_MATCH
    : PREFERRED_ACCEPT_CUSTOMER_CONFIRM;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
