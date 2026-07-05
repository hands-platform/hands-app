import { readFileSync } from 'node:fs';

describe('BookingChatBubble', () => {
  it('reuses the shared Vuexy chat message bubble atom', () => {
    const source = readFileSync('app/bookings/[id]/booking-chat-bubble.tsx', 'utf8');

    expect(source).toContain('AdminChatMessageBubble');
    expect(source).not.toContain('<p className="admin-chat-message-bubble">{message.body}</p>');
    expect(source).not.toContain('<div className="admin-chat-message-meta">');
  });

  it('passes raw message timestamps to the shared date atom instead of formatting locally', () => {
    const source = readFileSync('app/bookings/[id]/booking-chat-bubble.tsx', 'utf8');

    expect(source).toContain('createdDateTime: message.createdAt');
    expect(source).not.toContain("formatDateTime(message.createdAt, 'Not set')");
  });
});
