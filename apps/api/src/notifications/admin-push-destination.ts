import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';

export type AdminPushDestinationDefinition = {
  readonly label: string;
  readonly mode: 'LIST';
  readonly role: Extract<Role, 'CUSTOMER' | 'PROVIDER'>;
  readonly targetSummary: string;
  readonly value: string;
};

export const ADMIN_PUSH_DESTINATIONS = [
  {
    label: 'Notification center',
    mode: 'LIST',
    role: Role.CUSTOMER,
    targetSummary: 'Customer app notification center',
    value: 'notificationCenter',
  },
  {
    label: 'Bookings list',
    mode: 'LIST',
    role: Role.CUSTOMER,
    targetSummary: 'Customer app bookings list',
    value: 'booking',
  },
  {
    label: 'Notification center',
    mode: 'LIST',
    role: Role.PROVIDER,
    targetSummary: 'Partner app requests list',
    value: 'notificationCenter',
  },
  {
    label: 'Booking requests',
    mode: 'LIST',
    role: Role.PROVIDER,
    targetSummary: 'Partner app booking requests list',
    value: 'booking',
  },
  {
    label: 'Active jobs',
    mode: 'LIST',
    role: Role.PROVIDER,
    targetSummary: 'Partner app jobs list',
    value: 'jobs',
  },
  {
    label: 'Earnings',
    mode: 'LIST',
    role: Role.PROVIDER,
    targetSummary: 'Partner app earnings overview',
    value: 'earnings',
  },
  {
    label: 'Profile',
    mode: 'LIST',
    role: Role.PROVIDER,
    targetSummary: 'Partner app profile',
    value: 'profile',
  },
] as const satisfies readonly AdminPushDestinationDefinition[];

export function adminPushDestination(
  role: Extract<Role, 'CUSTOMER' | 'PROVIDER'>,
  rawValue?: string,
): AdminPushDestinationDefinition {
  const value = rawValue?.trim() || 'notificationCenter';
  const destination = ADMIN_PUSH_DESTINATIONS.find(
    (candidate) => candidate.role === role && candidate.value === value,
  );
  if (!destination) {
    throw new BadRequestException(`Unsupported manual push app destination for ${role}`);
  }
  return destination;
}
