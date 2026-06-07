export type BookingOpsBadgeInput = {
  status?: string | null;
  payment?: { status?: string | null } | null;
  selectedProvider?: unknown;
  chatRoom?: unknown;
};

export type BookingOpsAttentionFlagInput = {
  severity?: 'high' | 'medium' | 'low' | string | null;
};

export type BookingOpsLocationFreshness = 'recent' | 'stale' | 'expired' | 'missing';

export type BookingOpsBadge = {
  label: string;
  tone: string;
};

export type BookingOpsBadgeOptions = {
  attentionFlags?: BookingOpsAttentionFlagInput[];
  cashDebtNeedsSettlement?: boolean;
  locationFreshness?: BookingOpsLocationFreshness;
};

export function bookingOpsBadges(
  booking: BookingOpsBadgeInput,
  options: BookingOpsBadgeOptions = {},
): BookingOpsBadge[] {
  const badges: BookingOpsBadge[] = [];
  const flags = options.attentionFlags ?? [];

  if (booking.status === 'NO_SHOW') {
    badges.push({ label: 'No-show', tone: 'pill-danger' });
  }
  if (booking.status === 'EXPIRED') {
    badges.push({ label: 'Expired', tone: 'pill-warn' });
  }
  if (flags.some((flag) => flag.severity === 'high')) {
    badges.push({ label: 'Action needed', tone: 'pill-danger' });
  } else if (flags.some((flag) => flag.severity === 'medium')) {
    badges.push({ label: 'Needs watch', tone: 'pill-warn' });
  }
  if (booking.payment?.status === 'AUTHORIZED') {
    badges.push({ label: 'Hold active', tone: 'pill-warn' });
  }
  if (booking.payment?.status === 'RELEASED') {
    badges.push({ label: 'Hold released', tone: 'pill-success' });
  }
  if (booking.payment?.status === 'CAPTURED') {
    badges.push({ label: 'Captured', tone: 'pill-success' });
  }
  if (booking.payment?.status === 'REFUNDED') {
    badges.push({ label: 'Refunded', tone: 'pill-warn' });
  }
  if (options.cashDebtNeedsSettlement) {
    badges.push({ label: 'Cash fee debt', tone: 'pill-danger' });
  }
  if (booking.selectedProvider) {
    badges.push({ label: 'Partner selected', tone: 'pill-success' });
  }
  if (booking.chatRoom) {
    badges.push({ label: 'Chat ready', tone: 'pill-info' });
  }
  if (options.locationFreshness === 'recent') {
    badges.push({ label: 'Location recent', tone: 'pill-success' });
  }
  if (options.locationFreshness === 'stale') {
    badges.push({ label: 'Location stale', tone: 'pill-warn' });
  }
  if (options.locationFreshness === 'expired') {
    badges.push({ label: 'Location too old', tone: 'pill-info' });
  }
  if (badges.length === 0) {
    badges.push({ label: 'Monitor', tone: 'pill-neutral' });
  }
  return badges;
}
