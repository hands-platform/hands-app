import { Role } from '@prisma/client';

export type NotificationDeviceTokenUser = {
  id: string;
  roles: readonly Role[];
};

export type RegisterDeviceTokenInput = {
  token: string;
  platform: string;
};

export function resolvePushDeviceRole(roles: readonly Role[]) {
  if (roles.includes(Role.CUSTOMER)) {
    return Role.CUSTOMER;
  }

  if (roles.includes(Role.PROVIDER)) {
    return Role.PROVIDER;
  }

  return null;
}

export function pushDeviceRegistrationInput(
  user: NotificationDeviceTokenUser,
  input: RegisterDeviceTokenInput,
  lastSeenAt = new Date(),
) {
  const role = requirePushDeviceRole(user.roles);

  return {
    where: { token: input.token },
    update: {
      userId: user.id,
      role,
      platform: input.platform,
      enabled: true,
      lastSeenAt,
    },
    create: {
      userId: user.id,
      role,
      token: input.token,
      platform: input.platform,
      lastSeenAt,
    },
  };
}

function requirePushDeviceRole(roles: readonly Role[]) {
  const role = resolvePushDeviceRole(roles);
  if (!role) {
    throw new Error('Push device registration requires a customer or provider role');
  }
  return role;
}

export function pushDeviceDisableInput(userId: string, token: string, lastSeenAt = new Date()) {
  return {
    where: { userId, token },
    data: { enabled: false, lastSeenAt },
  };
}
