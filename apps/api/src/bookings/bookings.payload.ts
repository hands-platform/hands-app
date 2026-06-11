import { Prisma } from '@prisma/client';

export function normalizeBookingAddress(address: Prisma.InputJsonValue | undefined, addressText: string) {
  if (address && typeof address === 'object' && !Array.isArray(address)) {
    return { ...(address as Record<string, unknown>), addressText } as Prisma.InputJsonValue;
  }
  if (typeof address === 'string' && address.trim()) {
    return { addressText: address.trim() } as Prisma.InputJsonValue;
  }
  return { addressText } as Prisma.InputJsonValue;
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
