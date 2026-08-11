import { Prisma } from '@prisma/client';

const adminChatArchiveUserSelect = {
  fullName: true,
} satisfies Prisma.UserSelect;

const adminChatArchiveProviderSelect = {
  id: true,
  displayName: true,
  user: { select: adminChatArchiveUserSelect },
} satisfies Prisma.ProviderProfileSelect;

export const adminChatArchiveMessageSelect = {
  id: true,
  body: true,
  attachments: true,
  createdAt: true,
  sender: {
    select: {
      id: true,
      fullName: true,
      roles: true,
    },
  },
  chatRoom: {
    select: {
      id: true,
      booking: {
        select: {
          id: true,
          customerProfileId: true,
          status: true,
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
        },
      },
    },
  },
} satisfies Prisma.ChatMessageSelect;
