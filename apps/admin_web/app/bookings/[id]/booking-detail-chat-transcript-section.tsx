import type { AdminChatMessage } from '../../../lib/admin-api';
import { BookingChatBubble } from './booking-chat-bubble';

export type BookingDetailChatTranscriptSectionProps = {
  readonly messages: readonly AdminChatMessage[];
};

export function BookingDetailChatTranscriptSection({ messages }: BookingDetailChatTranscriptSectionProps) {
  return (
    <section className="card admin-mb-16 booking-detail-chat-transcript" id="booking-chat-history">
      <div className="ops-section-header">
        <div>
          <h3>Customer and Partner chat history</h3>
          <p className="muted">Retained booking chat transcript.</p>
        </div>
        <span className="pill pill-info">{countLabel(messages.length, 'message')}</span>
      </div>
      <div className="booking-chat-transcript-panel">
        {messages.map((message) => (
          <BookingChatBubble key={message.id} message={message} />
        ))}
        {messages.length === 0 && <p className="booking-chat-empty">No retained chat yet.</p>}
      </div>
    </section>
  );
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }

  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
