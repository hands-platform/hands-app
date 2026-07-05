import type { ActionMenuItem } from '../../../components/action-menu';
import type { AdminProvider } from '../../../lib/admin-api';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import type {
  PartnerDeviceRow,
  PartnerSessionRow,
  PartnerSharedDeviceRow,
} from './partner-detail-device-session-activity-section';
import { maskDeviceId } from './partner-detail-format';

type PartnerDeviceSessionProvider = Pick<
  AdminProvider,
  'devices' | 'sessions' | 'sharedDeviceMatches'
> & {
  readonly id?: string;
};

type PartnerDevice = NonNullable<AdminProvider['devices']>[number];

export type PartnerDeviceActionBuilder = (device: PartnerDevice) => readonly ActionMenuItem[];

export function displaySessionCheckText(value?: string | null) {
  const text = value?.trim() || 'Session check';

  return marketplaceDisplayText(text)
    .replace(/\bsuspicious session\b/gi, 'session check')
    .replace(/\bsuspicious\b/gi, 'session check')
    .replace(/\bfraud\b/gi, 'account review')
    .replace(/\bmisuse\b/gi, 'account review')
    .replace(/\babuse controls\b/gi, 'account controls')
    .replace(/\btrusted partner\b/gi, 'active partner');
}

export function buildPartnerDeviceRows(
  provider: PartnerDeviceSessionProvider,
  buildActions: PartnerDeviceActionBuilder,
): PartnerDeviceRow[] {
  return (provider.devices ?? []).map((device) => {
    const title = maskDeviceId(device.deviceId);

    return {
      actionLabel: `Device actions for ${title}`,
      actions: buildActions(device),
      blockReason: device.blockReason,
      blockedAt: device.blockedAt,
      detail: `${device.platform ?? 'unknown platform'} / ${device.appVersion ?? 'unknown app'}`,
      id: device.id,
      lastSeenAt: device.lastSeenAt,
      smallLabel: device.blockedAt ? 'Blocked' : 'Active',
      statusLabel: device.blockedAt ? 'BLOCKED' : device.enabled ? 'ENABLED' : 'DISABLED',
      title,
    };
  });
}

export function buildPartnerSessionRows(
  provider: PartnerDeviceSessionProvider,
): PartnerSessionRow[] {
  return (provider.sessions ?? []).slice(0, 6).map((session) => ({
    detail: `IP ${session.ipAddress ?? 'missing'} / ${session.appVersion ?? 'unknown app'}`,
    id: session.id,
    lastSeenAt: session.lastSeenAt,
    loggedInAt: session.loggedInAt,
    sessionNote: session.suspiciousReason ? displaySessionCheckText(session.suspiciousReason) : null,
    smallLabel: 'Login missing',
    statusLabel: session.suspicious ? 'CHECK' : 'OK',
    title: maskDeviceId(session.deviceId),
  }));
}

export function buildPartnerSharedDeviceRows(
  provider: PartnerDeviceSessionProvider,
): PartnerSharedDeviceRow[] {
  return (provider.sharedDeviceMatches ?? []).map((match) => ({
    detail: `Also used by ${marketplaceDisplayText(match.providerProfile?.displayName ?? 'another partner')} (${
      match.providerProfile?.user?.phone ?? 'no phone'
    })`,
    id: match.id,
    lastSeenAt: match.lastSeenAt,
    smallLabel: match.enabled ? 'Enabled' : 'Disabled',
    title: maskDeviceId(match.deviceId),
  }));
}
