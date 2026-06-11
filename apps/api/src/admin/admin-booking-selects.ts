import { Prisma } from '@prisma/client';

export const adminAddressSnapshotSelect = {
  id: true,
  bookingId: true,
  customerProfileId: true,
  selectedLocationId: true,
  address: true,
  addressText: true,
  latitude: true,
  longitude: true,
  source: true,
  createdAt: true,
} satisfies Prisma.BookingAddressSnapshotSelect;

export const adminChatRoomPresenceSelect = {
  id: true,
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      createdAt: true,
      body: true,
      sender: { select: { id: true, phone: true, fullName: true, roles: true } },
    },
  },
} satisfies Prisma.ChatRoomSelect;

export const adminBookingOpsTaskSummarySelect = {
  id: true,
  bookingId: true,
  type: true,
  status: true,
  note: true,
  actorId: true,
  createdAt: true,
  updatedAt: true,
  actor: { select: { id: true, phone: true, fullName: true } },
} satisfies Prisma.BookingOpsTaskSelect;

export const adminChatMessageSummarySelect = {
  id: true,
  chatRoomId: true,
  senderId: true,
  body: true,
  attachments: true,
  createdAt: true,
  sender: { select: { id: true, phone: true, fullName: true, roles: true } },
} satisfies Prisma.ChatMessageSelect;
