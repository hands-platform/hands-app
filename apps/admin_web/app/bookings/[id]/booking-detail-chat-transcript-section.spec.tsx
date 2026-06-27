import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminChatMessage } from '../../../lib/admin-api';
import { BookingDetailChatTranscriptSection } from './booking-detail-chat-transcript-section';

describe('BookingDetailChatTranscriptSection', () => {
  it('renders booking chat messages in the visible booking detail flow', () => {
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
    expect(rendered).toContain('Read-only retained booking chat transcript.');
    expect(rendered).toContain('Booking chat evidence');
    expect(rendered).toContain('2 messages');
    expect(rendered).toContain('Customer requested the room change.');
    expect(rendered).toContain('Partner confirmed arrival.');
    expect(rendered).toContain('Customer Nguyen');
    expect(rendered).toContain('Partner Linh');
    expect(markup).toContain('id="booking-chat-history"');
    expect(markup).toContain('booking-chat-transcript-panel');
  });

  it('keeps the full message count while rendering a compact transcript preview', () => {
    const markup = renderToStaticMarkup(
      <BookingDetailChatTranscriptSection
        archiveHref="/chat-archive?q=booking-1"
        messages={[
          chatMessageFixture({ id: 'message-2', body: 'Latest visible message.' }),
        ]}
        totalMessages={8}
      />,
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('8 messages');
    expect(rendered).toContain('Latest visible message.');
    expect(rendered).toContain('Showing latest 1 of 8 messages.');
    expect(rendered).toContain('Open full chat window');
    expect(markup).toContain('href="/chat-archive?q=booking-1"');
  });

  it('renders a compact empty state', () => {
    const markup = renderToStaticMarkup(<BookingDetailChatTranscriptSection messages={[]} />);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('No messages');
    expect(rendered).toContain('No retained chat yet.');
    expect(markup).toContain('admin-chat-window');
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
