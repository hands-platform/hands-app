import type { AdminChatMessage } from '../../../lib/admin-api';
import { BookingChatBubble } from './booking-chat-bubble';

export type BookingDetailChatTranscriptSectionProps = {
  readonly messages: readonly AdminChatMessage[];
  readonly archiveHref?: string;
  readonly totalMessages?: number;
};

export function BookingDetailChatTranscriptSection({
  archiveHref,
  messages,
  totalMessages = messages.length,
}: BookingDetailChatTranscriptSectionProps) {
  const hiddenMessageCount = Math.max(totalMessages - messages.length, 0);

  return (
    <section className="card admin-mb-16 booking-detail-chat-transcript" id="booking-chat-history">
      <div className="ops-section-header">
        <div>
          <h3>Customer and Partner chat history</h3>
          <p className="muted">Latest retained booking chat transcript preview.</p>
        </div>
        <span className="pill pill-info">{countLabel(totalMessages, 'message')}</span>
      </div>
      <div className="booking-chat-transcript-panel">
        {messages.map((message) => (
          <BookingChatBubble key={message.id} message={message} />
        ))}
        {messages.length === 0 && <p className="booking-chat-empty">No retained chat yet.</p>}
      </div>
      {hiddenMessageCount > 0 && (
        <p className="muted admin-mt-10">
          Showing latest {messages.length} of {totalMessages} messages.{' '}
          {archiveHref ? (
            <a className="text-link" href={archiveHref}>
              Open full chat archive
            </a>
          ) : (
            'Open the chat archive for the full transcript.'
          )}
        </p>
      )}
    </section>
  );
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }

  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
