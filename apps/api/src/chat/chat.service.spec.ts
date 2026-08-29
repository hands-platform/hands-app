import { AdminOperatorPermissionCategory, Role } from '@prisma/client';

import { ChatService } from './chat.service';

const ADMIN_CHAT_USER = {
  id: 'admin-user',
  roles: [Role.ADMIN],
  adminPermissionCategories: [AdminOperatorPermissionCategory.BOOKINGS_DETAIL],
};

describe('ChatService access control', () => {
  it('does not allow admin access to a missing chat room', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.canAccessChatRoom('missing-room', {
        ...ADMIN_CHAT_USER,
      }),
    ).resolves.toBe(false);

    expect(prisma.chatRoom.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'missing-room' },
      }),
    );
  });

  it('allows admin access when the chat room exists', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'partner-1',
          },
        }),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.canAccessChatRoom('chat-room-1', {
        ...ADMIN_CHAT_USER,
      }),
    ).resolves.toBe(true);
  });

  it('keeps the REST/UI Master Admin bypass for chat read and write', async () => {
    const room = {
      id: 'chat-room-1',
      booking: {
        customerProfileId: 'customer-1',
        selectedProviderId: 'partner-1',
      },
    };
    const prisma = {
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room) },
      chatMessage: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'message-1', body: 'Operator note' }),
      },
    };
    const service = new ChatService(prisma as never);
    const master = {
      id: 'master-admin-user',
      roles: [Role.ADMIN, Role.MASTER_ADMIN],
      adminPermissionCategories: [],
    };

    await expect(service.listMessages('chat-room-1', master)).resolves.toEqual([]);
    await expect(
      service.createMessage('chat-room-1', master, { text: 'Operator note' }),
    ).resolves.toMatchObject({ id: 'message-1' });
    expect(prisma.chatMessage.create).toHaveBeenCalledOnce();
  });

  it.each([
    ['Finance-only', [AdminOperatorPermissionCategory.FINANCE], false],
    ['Booking-only', [AdminOperatorPermissionCategory.BOOKINGS], true],
    ['read-only realtime', [AdminOperatorPermissionCategory.BOOKINGS_REALTIME], false],
  ])('enforces the %s chat-room matrix', async (_, categories, allowed) => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: { customerProfileId: 'customer-1', selectedProviderId: 'partner-1' },
        }),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.canAccessChatRoom('chat-room-1', {
        id: 'matrix-admin',
        roles: [Role.ADMIN],
        adminPermissionCategories: categories,
      }),
    ).resolves.toBe(allowed);
  });

  it('denies an Admin operator without booking-detail permission', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'partner-1',
          },
        }),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.canAccessChatRoom('chat-room-1', {
        id: 'support-only-admin',
        roles: [Role.ADMIN],
        adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS],
      }),
    ).resolves.toBe(false);
  });

  it('allows only the customer and final selected partner to access a booking chat room', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'selected-partner',
          },
        }),
      },
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: 'selected-partner' })
          .mockResolvedValueOnce({ id: 'joined-but-not-selected' }),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.canAccessChatRoom('chat-room-1', {
        id: 'customer-user',
        roles: [Role.CUSTOMER],
      }),
    ).resolves.toBe(true);
    await expect(
      service.canAccessChatRoom('chat-room-1', {
        id: 'selected-partner-user',
        roles: [Role.PROVIDER],
      }),
    ).resolves.toBe(true);
    await expect(
      service.canAccessChatRoom('chat-room-1', {
        id: 'joined-partner-user',
        roles: [Role.PROVIDER],
      }),
    ).resolves.toBe(false);

    expect(prisma.customerProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'customer-user' },
      select: { id: true },
    });
    expect(prisma.providerProfile.findUnique).toHaveBeenNthCalledWith(1, {
      where: { userId: 'selected-partner-user' },
      select: { id: true },
    });
    expect(prisma.providerProfile.findUnique).toHaveBeenNthCalledWith(2, {
      where: { userId: 'joined-partner-user' },
      select: { id: true },
    });
  });
});

describe('ChatService message validation', () => {
  it('notifies the other booking chat participant without exposing message text', async () => {
    const notifications = {
      create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    const prisma = {
      chatRoom: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'chat-room-1',
            booking: {
              customerProfileId: 'customer-1',
              selectedProviderId: 'partner-1',
            },
          })
          .mockResolvedValueOnce({
            bookingId: 'booking-1',
            booking: {
              customerProfile: { userId: 'customer-user' },
              selectedProvider: { userId: 'partner-user' },
            },
          }),
      },
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue({
          id: 'message-1',
          chatRoomId: 'chat-room-1',
          senderId: 'customer-user',
          body: 'See you soon',
        }),
      },
    };
    const service = new ChatService(prisma as never, notifications as never);

    await expect(
      service.createMessage(
        'chat-room-1',
        { id: 'customer-user', roles: [Role.CUSTOMER] },
        { text: 'See you soon' },
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));

    expect(notifications.create).toHaveBeenCalledWith({
      userId: 'partner-user',
      targetRole: Role.PROVIDER,
      type: 'chat.message.created',
      title: 'New chat message',
      body: 'A new message is available in your booking chat.',
      data: {
        destination: 'chat',
        bookingId: 'booking-1',
        chatRoomId: 'chat-room-1',
      },
      sourceKey: 'chat-message:message-1:partner-user',
    });
  });

  it('returns the committed chat message and records evidence when notification registration fails', async () => {
    const notifications = {
      create: vi.fn().mockRejectedValue(new Error('Notification queue unavailable')),
    };
    const auditUpsert = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const prisma = {
      chatRoom: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'chat-room-1',
            booking: {
              customerProfileId: 'customer-1',
              selectedProviderId: 'partner-1',
            },
          })
          .mockResolvedValueOnce({
            bookingId: 'booking-1',
            booking: {
              customerProfile: { userId: 'customer-user' },
              selectedProvider: { userId: 'partner-user' },
            },
          }),
      },
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue({
          id: 'message-1',
          chatRoomId: 'chat-room-1',
          senderId: 'customer-user',
          body: 'See you soon',
        }),
      },
      adminAuditLog: { upsert: auditUpsert },
    };
    const service = new ChatService(prisma as never, notifications as never);

    await expect(
      service.createMessage(
        'chat-room-1',
        { id: 'customer-user', roles: [Role.CUSTOMER] },
        { text: 'See you soon' },
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));

    expect(auditUpsert).toHaveBeenCalledWith({
      where: { eventId: 'chat-message-notification-failed:message-1:partner-user' },
      update: {},
      create: expect.objectContaining({
        eventId: 'chat-message-notification-failed:message-1:partner-user',
        action: 'chat.message.notification_failed',
        metadata: expect.objectContaining({
          chatMessageId: 'message-1',
          chatRoomId: 'chat-room-1',
          recipientUserId: 'partner-user',
        }),
      }),
    });
    expect(auditUpsert.mock.calls[0]?.[0]?.create?.metadata).not.toHaveProperty('body');
  });

  it('rejects oversized realtime chat messages at the service boundary', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'partner-1',
          },
        }),
      },
      chatMessage: {
        create: vi.fn(),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.createMessage(
        'chat-room-1',
        ADMIN_CHAT_USER,
        { text: 'x'.repeat(2001) },
      ),
    ).rejects.toThrow('Message body must be 2000 characters or fewer');

    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('rejects oversized chat attachment metadata at the service boundary', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'partner-1',
          },
        }),
      },
      chatMessage: {
        create: vi.fn(),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.createMessage(
        'chat-room-1',
        ADMIN_CHAT_USER,
        {
          text: 'Please review this attachment',
          attachments: [{ id: 'file-1', note: 'x'.repeat(5000) }],
        },
      ),
    ).rejects.toThrow('Chat attachment metadata is too large');

    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('rejects client-defined attachment URLs and metadata', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'partner-1',
          },
        }),
      },
      chatMessage: {
        create: vi.fn(),
      },
      fileAsset: {
        findMany: vi.fn(),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.createMessage(
        'chat-room-1',
        ADMIN_CHAT_USER,
        {
          text: 'Please review this attachment',
          attachments: [{ id: 'file-1', url: 'https://attacker.example/file' }],
        },
      ),
    ).rejects.toThrow('Chat attachments may contain only a file id');

    expect(prisma.fileAsset.findMany).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('rejects attachment references that are not uploaded private files owned by the sender', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'partner-1',
          },
        }),
      },
      chatMessage: {
        create: vi.fn(),
      },
      fileAsset: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.createMessage(
        'chat-room-1',
        ADMIN_CHAT_USER,
        {
          text: 'Please review this attachment',
          attachments: [{ id: 'another-user-file' }],
        },
      ),
    ).rejects.toThrow('Chat attachments must be uploaded private files owned by the sender');

    expect(prisma.fileAsset.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['another-user-file'] },
        ownerUserId: 'admin-user',
        purpose: 'CHAT_ATTACHMENT',
        uploadStatus: 'UPLOADED',
        visibility: 'PRIVATE',
      },
      select: { id: true },
    });
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('stores only validated attachment file references', async () => {
    const prisma = {
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'chat-room-1',
          booking: {
            customerProfileId: 'customer-1',
            selectedProviderId: 'partner-1',
          },
        }),
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue({ id: 'message-1' }),
      },
      fileAsset: {
        findMany: vi.fn().mockResolvedValue([{ id: 'file-1' }]),
      },
    };
    const service = new ChatService(prisma as never);

    await expect(
      service.createMessage(
        'chat-room-1',
        ADMIN_CHAT_USER,
        {
          text: 'Please review this attachment',
          attachments: [{ id: 'file-1' }],
        },
      ),
    ).resolves.toEqual({ id: 'message-1' });

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachments: [{ id: 'file-1' }],
        }),
      }),
    );
  });
});
