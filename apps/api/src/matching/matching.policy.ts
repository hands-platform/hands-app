import { ConfigService } from '@nestjs/config';

export const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;
export const DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES = 10;
export const DEFAULT_BACKUP_PROVIDER_RADIUS_METERS = 10000;

export const MATCHING_TRAVEL_BUFFER_MINUTES_KEY = 'matching.travel_buffer_minutes';
export const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';
export const MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY = 'matching.backup_provider_radius_meters';
export const MATCHING_PREFERRED_ACCEPT_MODE_KEY = 'matching.preferred_accept_mode';
export const PREFERRED_ACCEPT_AUTO_MATCH = 'AUTO_MATCH_ON_ACCEPT';
export const PREFERRED_ACCEPT_CUSTOMER_CONFIRM = 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

export type PreferredAcceptMode =
  | typeof PREFERRED_ACCEPT_AUTO_MATCH
  | typeof PREFERRED_ACCEPT_CUSTOMER_CONFIRM;

export type MatchingPolicy = {
  travelBufferMinutes: number;
  providerResponseWindowMinutes: number;
  backupProviderRadiusMeters: number;
  preferredAcceptMode: PreferredAcceptMode;
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
    label: 'Preferred partner response window',
    description:
      'Minutes the first-picked partner has to accept before the request should be treated as at-risk.',
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
    key: MATCHING_TRAVEL_BUFFER_MINUTES_KEY,
    category: 'Matching',
    label: 'Travel buffer after a booking',
    description:
      'Buffer minutes after the current booking before a partner is considered available again.',
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
    label: 'When the preferred partner accepts',
    description:
      'Choose whether a preferred partner acceptance immediately matches the booking or still asks the customer to confirm.',
    value: PREFERRED_ACCEPT_AUTO_MATCH,
    recommendedValue: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    options: [
      {
        value: PREFERRED_ACCEPT_AUTO_MATCH,
        label: 'Auto match on partner accept',
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
    key: 'matching.backup_open_mode',
    category: 'Decision',
    label: 'When backup partners can join',
    description:
      'Choose whether nearby backup partners can join immediately during the first 10 minutes or only after a delay.',
    value: 'IMMEDIATE_WITHIN_WINDOW',
    recommendedValue: 'IMMEDIATE_WITHIN_WINDOW',
    options: [
      {
        value: 'IMMEDIATE_WITHIN_WINDOW',
        label: 'Open backups immediately',
        tradeoff: 'Reduces customer waiting anxiety and creates visible alternatives.',
      },
      {
        value: 'AFTER_FIRST_PICK_DELAY',
        label: 'Delay backup visibility',
        tradeoff: 'Less partner noise, but slower recovery if the preferred partner is late.',
      },
    ],
    enforced: false,
  },
  {
    key: 'wallet.negative_balance_gate',
    category: 'Decision',
    label: 'Negative wallet booking gate',
    description:
      'Choose how strictly partners with unpaid cash-service platform fees are blocked from accepting new work.',
    value: 'BLOCK_ACCEPTS_WHEN_NEGATIVE',
    recommendedValue: 'BLOCK_ACCEPTS_WHEN_NEGATIVE',
    options: [
      {
        value: 'BLOCK_ACCEPTS_WHEN_NEGATIVE',
        label: 'Block accepts while negative',
        tradeoff: 'Protects company fee collection and is already implemented.',
      },
      {
        value: 'ALLOW_ONE_RECOVERY_BOOKING',
        label: 'Allow one recovery booking',
        tradeoff: 'More partner-friendly, but increases unpaid-fee risk.',
      },
    ],
    enforced: false,
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
    preferredAcceptMode: readPreferredAcceptMode(settings[MATCHING_PREFERRED_ACCEPT_MODE_KEY]),
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
  return value === PREFERRED_ACCEPT_CUSTOMER_CONFIRM
    ? PREFERRED_ACCEPT_CUSTOMER_CONFIRM
    : PREFERRED_ACCEPT_AUTO_MATCH;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
