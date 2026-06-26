import { Role } from '@prisma/client';

export type NotificationDeviceTokenUser = {
  activeRole?: Role;
  id: string;
  roles: readonly Role[];
};

export type RegisterDeviceTokenInput = {
  token: string;
  platform: string;
  pushProvider?: string;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  locale?: string;
  timezone?: string;
};

export function resolvePushDeviceRole(roles: readonly Role[], activeRole?: Role) {
  if (activeRole && isPushDeviceRole(activeRole) && roles.includes(activeRole)) {
    return activeRole;
  }

  if (roles.includes(Role.CUSTOMER)) {
    return Role.CUSTOMER;
  }

  if (roles.includes(Role.PROVIDER)) {
    return Role.PROVIDER;
  }

  return null;
}

function isPushDeviceRole(role: Role) {
  return role === Role.CUSTOMER || role === Role.PROVIDER;
}

export function pushDeviceRegistrationInput(
  user: NotificationDeviceTokenUser,
  input: RegisterDeviceTokenInput,
  lastSeenAt = new Date(),
) {
  const role = requirePushDeviceRole(user.roles, user.activeRole);
  const token = normalizeRequiredText(input.token);
  const platform = normalizeRequiredText(input.platform).toLowerCase();
  const registrationMetadata = pushDeviceRegistrationMetadata(input);

  return {
    where: { token },
    update: {
      userId: user.id,
      role,
      platform,
      ...registrationMetadata,
      enabled: true,
      lastSeenAt,
    },
    create: {
      userId: user.id,
      role,
      token,
      platform,
      ...registrationMetadata,
      lastSeenAt,
    },
  };
}

function pushDeviceRegistrationMetadata(input: RegisterDeviceTokenInput) {
  return {
    pushProvider: input.pushProvider ?? 'FCM',
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    ...(input.osVersion ? { osVersion: input.osVersion } : {}),
    ...(input.deviceModel ? { deviceModel: input.deviceModel } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.timezone ? { timezone: input.timezone } : {}),
  };
}

function requirePushDeviceRole(roles: readonly Role[], activeRole?: Role) {
  const role = resolvePushDeviceRole(roles, activeRole);
  if (!role) {
    throw new Error('Push device registration requires a customer or provider role');
  }
  return role;
}

function normalizeRequiredText(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Push device registration requires token and platform');
  }
  return normalized;
}

export function pushDeviceDisableInput(userId: string, token: string, lastSeenAt = new Date()) {
  return {
    where: { userId, token },
    data: { enabled: false, lastSeenAt },
  };
}
