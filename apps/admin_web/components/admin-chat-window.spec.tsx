import { renderToStaticMarkup } from 'react-dom/server';

import { AdminChatMessageBubble, AdminChatWindow } from './admin-chat-window';

describe('AdminChatWindow', () => {
  it('exports a reusable Vuexy chat message bubble atom', () => {
    const markup = renderToStaticMarkup(
      <AdminChatMessageBubble
        message={{
          body: 'I am on the way.',
          createdDateTime: '2026-07-05T02:30:00.000Z',
          createdLabel: '05 Jul 2026, 02:30',
          id: 'message-1',
          role: 'PROVIDER',
          senderLabel: 'Partner One',
        }}
      />,
    );

    expect(markup).toContain('admin-chat-message is-outgoing');
    expect(markup).toContain('admin-chat-message-bubble');
    expect(markup).toContain(
      '<time class="date-time-text" dateTime="2026-07-05T02:30:00.000Z">5 Jul 2026, 09:30</time>',
    );
    expect(markup).not.toContain('05 Jul 2026, 02:30');
  });

  it('renders window messages through the shared bubble atom', () => {
    const markup = renderToStaticMarkup(
      <AdminChatWindow
        avatarLabel="Customer One"
        messages={[
          {
            body: 'Can you confirm the address?',
            createdLabel: '05 Jul 2026, 02:31',
            id: 'message-2',
            role: 'CUSTOMER',
            senderLabel: 'Customer One',
          },
        ]}
        subtitle="Booking chat"
        title="Customer One"
      />,
    );

    expect(markup).toContain('admin-chat-window');
    expect(markup).toContain('admin-chat-message is-incoming');
    expect(markup).toContain('Can you confirm the address?');
  });
});
