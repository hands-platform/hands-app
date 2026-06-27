import type { AdminChatMessage } from '../../../lib/admin-api';
import { formatDateTime } from '../../../lib/admin-format';

export function BookingChatBubble({ message }: BookingChatBubbleProps) {
  const role = chatSenderRole(message);
  const alignmentClass =
    role === 'PROVIDER' ? 'is-outgoing' : role === 'SYSTEM' || role === 'ADMIN' ? 'is-system' : 'is-incoming';
  const senderName = message.sender?.fullName ?? message.sender?.phone ?? displaySenderRole(role);

  return (
    <div className={`admin-chat-message ${alignmentClass}`}>
      {alignmentClass === 'is-incoming' && (
        <span className="admin-chat-avatar" aria-hidden="true">
          {senderInitial(senderName)}
        </span>
      )}
      <div className="admin-chat-message-content">
        <p className="admin-chat-message-bubble">{message.body}</p>
        <div className="admin-chat-message-meta">
          <span>{senderName}</span>
          <time dateTime={message.createdAt}>{formatDateTime(message.createdAt, 'Not set')}</time>
        </div>
      </div>
    </div>
  );
}

export type BookingChatBubbleProps = {
  message: AdminChatMessage;
};

function chatSenderRole(message: AdminChatMessage) {
  const roles = message.sender?.roles ?? [];
  if (roles.includes('PROVIDER')) return 'PROVIDER';
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return 'SYSTEM';
}

function displaySenderRole(role: string) {
  if (role === 'PROVIDER') return 'Partner';
  if (role === 'CUSTOMER') return 'Customer';
  if (role === 'ADMIN') return 'Admin';
  return 'System';
}

function senderInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'U';
}
