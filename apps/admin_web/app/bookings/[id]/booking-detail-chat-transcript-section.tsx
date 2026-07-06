import {
  AdminChatWindow,
  type AdminChatWindowMessage,
  type AdminChatWindowMessageRole,
} from '../../../components/admin-chat-window';
import { AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminChatMessage } from '../../../lib/admin-api';

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
  const chatMessages = messages.map(bookingDetailChatWindowMessage);

  return (
    <AdminSection
      actions={<StatusBadge tone="info">{countLabel(totalMessages, 'message')}</StatusBadge>}
      className="admin-mb-16 booking-detail-chat-transcript"
      description="Read-only retained booking chat transcript."
      id="booking-chat-history"
      title="Customer and Partner chat history"
    >
      <AdminChatWindow
        avatarLabel="HANDS"
        emptyMessage="No retained chat yet."
        messages={chatMessages}
        subtitle="Customer / Partner transcript"
        title="Booking chat evidence"
      />
      {hiddenMessageCount > 0 && (
        <p className="muted admin-mt-10">
          Showing latest {messages.length} of {totalMessages} messages.{' '}
          {archiveHref ? (
            <AdminTextLink href={archiveHref}>
              Open full chat window
            </AdminTextLink>
          ) : (
            'Open chat evidence search for the full transcript.'
          )}
        </p>
      )}
    </AdminSection>
  );
}

function bookingDetailChatWindowMessage(message: AdminChatMessage): AdminChatWindowMessage {
  const role = bookingDetailChatRole(message);
  return {
    body: message.body,
    createdDateTime: message.createdAt,
    id: message.id,
    role,
    senderLabel: message.sender?.fullName ?? message.sender?.phone ?? bookingDetailChatRoleLabel(role),
  };
}

function bookingDetailChatRole(message: AdminChatMessage): AdminChatWindowMessageRole {
  const roles = message.sender?.roles ?? [];
  if (roles.includes('PROVIDER')) return 'PROVIDER';
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return 'SYSTEM';
}

function bookingDetailChatRoleLabel(role: AdminChatWindowMessageRole) {
  if (role === 'PROVIDER') return 'Partner';
  if (role === 'CUSTOMER') return 'Customer';
  if (role === 'ADMIN') return 'Admin';
  return 'System';
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }

  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
