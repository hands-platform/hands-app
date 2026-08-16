import { Role } from '@prisma/client';
import { ChatController } from './chat.controller';

describe('ChatController', () => {
  it('persists HTTP messages and broadcasts the created record to the chat room', async () => {
    const message = {
      id: 'message-1',
      chatRoomId: 'room-1',
      senderId: 'customer-1',
      body: 'I am at the service address.',
    };
    const chat = {
      createMessage: vi.fn().mockResolvedValue(message),
    };
    const gateway = {
      emitMessageCreated: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new ChatController(chat as never, gateway as never);
    const user = {
      id: 'customer-1',
      activeRole: Role.CUSTOMER,
      roles: [Role.CUSTOMER],
    };

    await expect(
      controller.createMessage(user, 'room-1', {
        body: 'I am at the service address.',
      }),
    ).resolves.toEqual(message);

    expect(chat.createMessage).toHaveBeenCalledWith('room-1', user, {
      body: 'I am at the service address.',
    });
    expect(gateway.emitMessageCreated).toHaveBeenCalledWith('room-1', message);
  });
});
