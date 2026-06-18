export type AdminAvatarStatus = 'online' | 'matching' | 'working' | 'offline' | 'app-deleted';

export const adminAvatarStatusLabels: Record<AdminAvatarStatus, string> = {
  'app-deleted': 'App delete suspected',
  matching: 'Matching waiting',
  offline: 'App offline',
  online: 'App online',
  working: 'Work in progress',
};

export type AdminAvatarSessionSignal = {
  readonly active?: boolean;
  readonly deviceLanguage?: string | null;
  readonly lastSeenAt?: string | null;
};

export type AdminAvatarPushDeliverySignal = {
  readonly response?: unknown;
  readonly status?: string | null;
};

export type AdminAvatarPushDeviceSignal = {
  readonly deliveries?: readonly AdminAvatarPushDeliverySignal[];
  readonly enabled?: boolean;
  readonly lastSeenAt?: string | null;
};

type AdminAvatarStatusSignals = {
  readonly devices?: readonly AdminAvatarPushDeviceSignal[] | null;
  readonly fallbackOnline?: boolean;
  readonly matching?: boolean;
  readonly sessions?: readonly AdminAvatarSessionSignal[] | null;
  readonly working?: boolean;
};

const APP_ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const APP_DELETE_SUSPECT_MS = 30 * 24 * 60 * 60 * 1000;

export function adminAvatarStatusFromSignals({
  devices,
  fallbackOnline = false,
  matching = false,
  sessions,
  working = false,
}: AdminAvatarStatusSignals): AdminAvatarStatus {
  if (isAppDeleteSuspected(sessions, devices)) {
    return 'app-deleted';
  }
  if (working) {
    return 'working';
  }
  if (matching) {
    return 'matching';
  }
  if (fallbackOnline || hasActiveAvatarSession(sessions)) {
    return 'online';
  }
  return 'offline';
}

export function hasActiveAvatarSession(sessions: readonly AdminAvatarSessionSignal[] | null | undefined) {
  const now = Date.now();

  return (sessions ?? []).some((session) => {
    if (session.active === true) {
      return true;
    }
    const lastSeenAt = parseAvatarTimestamp(session.lastSeenAt);
    return lastSeenAt !== null && now - lastSeenAt <= APP_ACTIVE_WINDOW_MS;
  });
}

export function isAppDeleteSuspected(
  sessions: readonly AdminAvatarSessionSignal[] | null | undefined,
  devices: readonly AdminAvatarPushDeviceSignal[] | null | undefined,
) {
  const latestSeenAt = latestAvatarSeenAt([...(sessions ?? []), ...(devices ?? [])]);
  if (latestSeenAt === null || Date.now() - latestSeenAt < APP_DELETE_SUSPECT_MS) {
    return false;
  }

  return hasDisabledPushDevice(devices) || hasFailedPushDelivery(devices);
}

function latestAvatarSeenAt(items: readonly { readonly lastSeenAt?: string | null }[]) {
  const timestamps = items
    .map((item) => parseAvatarTimestamp(item.lastSeenAt))
    .filter((value): value is number => value !== null);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function parseAvatarTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasDisabledPushDevice(devices: readonly AdminAvatarPushDeviceSignal[] | null | undefined) {
  return (devices ?? []).some((device) => device.enabled === false);
}

function hasFailedPushDelivery(devices: readonly AdminAvatarPushDeviceSignal[] | null | undefined) {
  return (devices ?? []).some((device) => (device.deliveries ?? []).some(isFailedPushDelivery));
}

function isFailedPushDelivery(delivery: AdminAvatarPushDeliverySignal) {
  const status = delivery.status?.trim().toUpperCase();
  if (status && !['DELIVERED', 'OK', 'SENT', 'SUCCESS'].includes(status)) {
    return true;
  }

  return pushDeliveryResponseText(delivery.response).some((text) =>
    ['APNS_AUTH_ERROR', 'INVALID_ARGUMENT', 'NOT_FOUND', 'REGISTRATION_TOKEN_NOT_REGISTERED', 'UNREGISTERED'].some(
      (needle) => text.includes(needle),
    ),
  );
}

function pushDeliveryResponseText(response: unknown) {
  if (typeof response === 'string') {
    return [response.toUpperCase()];
  }
  try {
    return [JSON.stringify(response ?? '').toUpperCase()];
  } catch {
    return [];
  }
}
