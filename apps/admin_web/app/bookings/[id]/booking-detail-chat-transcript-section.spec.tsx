import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminChatMessage } from '../../../lib/admin-api';
import { BookingDetailChatTranscriptSection } from './booking-detail-chat-transcript-section';

describe('BookingDetailChatTranscriptSection', () => {
  it('renders all booking chat messages in the visible booking detail flow', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailChatTranscriptSection
        messages={[
          chatMessageFixture({
            body: 'Customer requested the room change.',
            id: 'message-1',
            sender: { id: 'customer-user-1', fullName: 'Customer Nguyen' },
          }),
          chatMessageFixture({
            body: 'Partner confirmed arrival.',
            id: 'message-2',
            sender: { id: 'partner-user-1', fullName: 'Partner Linh' },
          }),
        ]}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Customer and Partner chat history');
    expect(rendered).toContain('Retained booking chat transcript.');
    expect(rendered).toContain('2 messages');
    expect(rendered).toContain('Customer requested the room change.');
    expect(rendered).toContain('Partner confirmed arrival.');
    expect(rendered).toContain('Customer Nguyen');
    expect(rendered).toContain('Partner Linh');
    expect(markup).toContain('id="booking-chat-history"');
    expect(markup).toContain('booking-chat-transcript-panel');
  });

  it('renders a compact empty state', () => {
    const markup = renderToStaticMarkup(<BookingDetailChatTranscriptSection messages={[]} />);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('No messages');
    expect(rendered).toContain('No retained chat yet.');
    expect(markup).toContain('booking-chat-empty');
  });
});

function chatMessageFixture(input: Partial<AdminChatMessage>): AdminChatMessage {
  return {
    body: 'Message',
    createdAt: '2026-06-19T08:00:00.000Z',
    id: 'message',
    ...input,
  } as AdminChatMessage;
}

function normalizedText(markup: string) {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
