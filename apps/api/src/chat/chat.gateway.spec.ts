import { AdminOperatorPermissionCategory, Role } from '@prisma/client';

import { ChatGateway } from './chat.gateway';

describe('ChatGateway Admin room authorization evidence', () => {
  it('records a denied Admin chat-room join without joining the room', async () => {
    const user = {
      id: 'admin-1',
      roles: [Role.ADMIN],
      adminPermissionCategories: [AdminOperatorPermissionCategory.BOOKINGS_REALTIME],
    };
    const recordAdminAuthorizationDenial = vi.fn();
    const gateway = new ChatGateway(
      {
        recordAdminAuthorizationDenial,
        requireCurrentUser: vi.fn().mockResolvedValue(user),
      } as never,
      { canAccessChatRoom: vi.fn().mockResolvedValue(false) } as never,
    );
    const client = { join: vi.fn() };

    await expect(
      gateway.joinChatRoom(client as never, { chatRoomId: 'chat-room-1' }),
    ).resolves.toEqual({ ok: false, error: 'CHAT_ROOM_FORBIDDEN' });

    expect(recordAdminAuthorizationDenial).toHaveBeenCalledWith(
      user,
      'chat_room:chat-room-1',
      'CHAT_ROOM_FORBIDDEN',
    );
    expect(client.join).not.toHaveBeenCalled();
  });

  it('removes stale room members before broadcasting a new message', async () => {
    const allowedUser = { id: 'customer-1', roles: [Role.CUSTOMER] };
    const staleUser = { id: 'provider-1', roles: [Role.PROVIDER] };
    const allowedClient = { data: { user: allowedUser }, leave: vi.fn() };
    const staleClient = { data: { user: staleUser }, leave: vi.fn().mockResolvedValue(undefined) };
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const gateway = new ChatGateway({} as never, {
      canAccessChatRoom: vi.fn(async (_roomId, user) => user.id === allowedUser.id),
    } as never);
    gateway.server = {
      in: vi.fn().mockReturnValue({ fetchSockets: vi.fn().mockResolvedValue([allowedClient, staleClient]) }),
      to,
    } as never;

    await gateway.emitMessageCreated('chat-room-1', { id: 'message-1' });

    expect(allowedClient.leave).not.toHaveBeenCalled();
    expect(staleClient.leave).toHaveBeenCalledWith('chat:chat-room-1');
    expect(to).toHaveBeenCalledWith('chat:chat-room-1');
    expect(emit).toHaveBeenCalledWith('chat.message.created', { id: 'message-1' });
  });

  it('rejects message creation when the per-user socket budget is exhausted', async () => {
    const createMessage = vi.fn();
    const gateway = new ChatGateway(
      {
        requireCurrentUser: vi.fn().mockResolvedValue({ id: 'customer-1', roles: [Role.CUSTOMER] }),
      } as never,
      { createMessage } as never,
      { consumeRateLimit: vi.fn().mockResolvedValue({ count: 31 }) } as never,
    );

    await expect(
      gateway.createMessage({} as never, { chatRoomId: 'chat-room-1', text: 'hello' }),
    ).resolves.toEqual({ ok: false, error: 'CHAT_RATE_LIMITED' });
    expect(createMessage).not.toHaveBeenCalled();
  });
});
