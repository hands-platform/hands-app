export type AdminChatWindowMessageRole = 'ADMIN' | 'CUSTOMER' | 'PROVIDER' | 'SYSTEM';

export type AdminChatWindowMessage = {
  readonly body: string;
  readonly createdLabel: string;
  readonly id: string;
  readonly role: AdminChatWindowMessageRole;
  readonly senderLabel: string;
};

type AdminChatWindowProps = {
  readonly avatarLabel: string;
  readonly className?: string;
  readonly emptyMessage?: string;
  readonly messages: readonly AdminChatWindowMessage[];
  readonly subtitle: string;
  readonly title: string;
};

export function AdminChatWindow({
  avatarLabel,
  className,
  emptyMessage = 'Chat room exists, but no messages have been sent yet.',
  messages,
  subtitle,
  title,
}: AdminChatWindowProps) {
  return (
    <div className={['admin-chat-window', className].filter(Boolean).join(' ')}>
      <div className="admin-chat-window-header">
        <div className="admin-chat-contact">
          <span className="admin-chat-contact-avatar" aria-hidden="true">
            {senderInitial(avatarLabel)}
            <span className="admin-chat-contact-status" />
          </span>
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </div>
      </div>
      <div className="booking-chat-transcript-panel admin-chat-window-body">
        {messages.length > 0 ? (
          messages.map((message) => (
            <AdminChatWindowMessageBubble key={message.id} message={message} />
          ))
        ) : (
          <p className="muted">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

function AdminChatWindowMessageBubble({ message }: { readonly message: AdminChatWindowMessage }) {
  const roleClass =
    message.role === 'PROVIDER'
      ? 'is-outgoing'
      : message.role === 'CUSTOMER'
        ? 'is-incoming'
        : 'is-system';

  return (
    <div className={`admin-chat-message ${roleClass}`}>
      {roleClass === 'is-incoming' ? (
        <span className="admin-chat-avatar" aria-hidden="true">
          {senderInitial(message.senderLabel)}
        </span>
      ) : null}
      <div className="admin-chat-message-content">
        <p className="admin-chat-message-bubble">{message.body}</p>
        <div className="admin-chat-message-meta">
          <span>{message.senderLabel}</span>
          <span>{message.createdLabel}</span>
        </div>
      </div>
    </div>
  );
}

function senderInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'U';
}
