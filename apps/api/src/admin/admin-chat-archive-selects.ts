import { Prisma } from '@prisma/client';

const adminChatArchiveUserSelect = {
  phone: true,
  fullName: true,
} satisfies Prisma.UserSelect;

const adminChatArchiveProviderSelect = {
  id: true,
  displayName: true,
  user: { select: adminChatArchiveUserSelect },
} satisfies Prisma.ProviderProfileSelect;

export const adminChatArchiveBookingSelect = {
  id: true,
  customerProfileId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  customerProfile: {
    select: {
      id: true,
      user: { select: adminChatArchiveUserSelect },
    },
  },
  preferredProvider: { select: adminChatArchiveProviderSelect },
  selectedProvider: { select: adminChatArchiveProviderSelect },
  services: {
    orderBy: { id: 'asc' },
    take: 1,
    select: {
      service: {
        select: {
          name: true,
          durationMin: true,
        },
      },
    },
  },
  chatRoom: {
    select: {
      id: true,
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          body: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              phone: true,
              fullName: true,
              roles: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BookingSelect;
