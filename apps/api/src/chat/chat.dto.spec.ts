import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ChatController } from './chat.controller';

describe('chat request DTO validation', () => {
  function createMessageBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      ChatController.prototype,
      'createMessage',
    ) as unknown[];
    return paramTypes?.[2] as object | undefined;
  }

  it('uses a concrete DTO for HTTP chat message creation', () => {
    expect((createMessageBodyMetatype() as { name?: string })?.name).toBe('CreateChatMessageDto');
  });

  it('strips unsupported chat message fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        body: 'Hello partner',
        attachments: [{ id: 'file-1' }],
        scheduledStartAt: '2026-06-01T10:00:00.000Z',
      },
      { type: 'body', metatype: createMessageBodyMetatype() as never, data: '' },
    );

    expect(transformed).toHaveProperty('body', 'Hello partner');
    expect(transformed).toHaveProperty('attachments');
    expect(transformed).not.toHaveProperty('scheduledStartAt');
  });

  it('rejects blank HTTP chat messages before service execution', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { body: '   ' },
        { type: 'body', metatype: createMessageBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();
  });
});
