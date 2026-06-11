import Link from 'next/link';

export type PartnerBookingChatMessageRow = {
  readonly body: string;
  readonly createdLabel: string;
  readonly id: string;
  readonly senderLabel: string;
};

export type PartnerBookingChatRecordRow = {
  readonly bookingHref: string;
  readonly chatHref?: string;
  readonly chatLine: string;
  readonly chatMessages: readonly PartnerBookingChatMessageRow[];
  readonly closureLine?: string;
  readonly customerHref?: string;
  readonly customerLine: string;
  readonly hasChatRoom: boolean;
  readonly heading: string;
  readonly key: string;
  readonly paymentLine: string;
  readonly relation: string;
};

type PartnerDetailBookingChatRecordsSectionProps = {
  readonly openBookingsHref: string;
  readonly rows: readonly PartnerBookingChatRecordRow[];
};

export function PartnerDetailBookingChatRecordsSection({
  openBookingsHref,
  rows,
}: PartnerDetailBookingChatRecordsSectionProps) {
  return (
    <div className="card admin-mb-16" id="booking-chat-records">
      <div className="ops-section-header">
        <div>
          <h2>Booking and chat records</h2>
          <p className="muted">
            Every matched booking should have a chat room. Completed service chats disappear from mobile
            apps, but the admin archive remains visible here.
          </p>
        </div>
        <Link className="text-link" href={openBookingsHref}>
          Open bookings
        </Link>
      </div>
      <div className="setup-stage-list admin-mt-16">
        {rows.length ? (
          rows.map((row) => (
            <div className="setup-stage-item" key={row.key}>
              <span>{row.relation}</span>
              <div>
                <strong>{row.heading}</strong>
                <p className="muted">{row.customerLine}</p>
                <p className="muted">{row.paymentLine}</p>
                {row.closureLine ? <p className="muted">{row.closureLine}</p> : null}
                <p className="muted">{row.chatLine}</p>
                {row.hasChatRoom ? (
                  <div className="ops-task-note admin-mt-10">
                    <strong>Admin chat archive</strong>
                    <p className="muted">
                      Mobile chat hides after service completion. Admin keeps this booking transcript.
                    </p>
                    <div className="admin-grid-gap-8 admin-mt-10">
                      {row.chatMessages.map((message) => (
                        <div className="service-matrix-cell" key={message.id}>
                          <strong>{message.senderLabel}</strong>
                          <small>{message.createdLabel}</small>
                          <p className="admin-m-0">{message.body}</p>
                        </div>
                      ))}
                      {!row.chatMessages.length ? (
                        <p className="muted">Chat room exists, but no message is stored yet.</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="ops-task-note admin-mt-10">
                    <strong>Chat room missing</strong>
                    <p className="muted">
                      A matched booking should create a chat room. Open the booking detail if this booking
                      is already matched or in service.
                    </p>
                  </div>
                )}
              </div>
              <div className="participant-list">
                <Link className="text-link" href={row.bookingHref}>
                  Open booking
                </Link>
                {row.customerHref ? (
                  <Link className="text-link" href={row.customerHref}>
                    Open customer
                  </Link>
                ) : null}
                {row.chatHref ? (
                  <Link className="text-link" href={row.chatHref}>
                    Open chat archive
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="setup-stage-item">
            <span>NONE</span>
            <div>
              <strong>No booking records matched this date filter</strong>
              <p className="muted">Clear the date filter or choose a wider range to review the archive.</p>
            </div>
            <small>0</small>
          </div>
        )}
      </div>
    </div>
  );
}
