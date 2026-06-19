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
          <p className="muted">Full booking chat transcript, sorted from first message to latest.</p>
        </div>
        <span className="pill pill-info">{messages.length} message(s)</span>
      </div>
      <div className="stack admin-mt-12">
        {messages.map((message) => (
          <BookingChatBubble key={message.id} message={message} />
        ))}
        {messages.length === 0 && <p className="muted">No chat messages yet.</p>}
      </div>
    </section>
  );
}
