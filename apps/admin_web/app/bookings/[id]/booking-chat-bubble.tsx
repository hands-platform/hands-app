import type { AdminChatMessage } from '../../../lib/admin-api';
import { formatDateTime } from '../../../lib/admin-format';

export function BookingChatBubble({ message }: BookingChatBubbleProps) {
  return (
    <div className="chat-bubble">
      <strong>{message.body}</strong>
      <div className="muted">
        {message.sender?.fullName ?? message.sender?.phone ?? 'Sender'} -{' '}
        {formatDateTime(message.createdAt, 'Not set')}
      </div>
    </div>
  );
}

export type BookingChatBubbleProps = {
  message: AdminChatMessage;
};
