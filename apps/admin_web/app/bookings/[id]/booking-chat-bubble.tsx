import { AdminChatMessageBubble } from '../../../components/admin-chat-window';
import type { AdminChatMessage } from '../../../lib/admin-api';

export function BookingChatBubble({ message }: BookingChatBubbleProps) {
  const role = chatSenderRole(message);
  const senderName = message.sender?.fullName ?? message.sender?.phone ?? displaySenderRole(role);

  return (
    <AdminChatMessageBubble
      message={{
        body: message.body,
        createdDateTime: message.createdAt,
        id: message.id,
        role,
        senderLabel: senderName,
      }}
    />
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
