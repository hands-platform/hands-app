import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Every matched booking should have a chat room. Completed service chats disappear from mobile apps, but the admin archive remains visible here."
      footer={
        <Link className="text-link" href={openBookingsHref}>
          Open bookings
        </Link>
      }
      id="booking-chat-records"
      resultLabel={`${rows.length} record(s)`}
      title="Booking and chat records"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={
            <PartnerBookingChatEmptyState message="Clear the date filter or choose a wider range to review the archive." />
          }
          headers={bookingChatHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <span className={`pill ${row.hasChatRoom ? 'pill-success' : 'pill-danger'}`}>
                  {row.relation}
                </span>
              </td>
              <td>
                <strong>{row.heading}</strong>
                <p className="muted">{row.customerLine}</p>
              </td>
              <td>
                <span className="muted">{row.paymentLine}</span>
                {row.closureLine ? <p className="muted">{row.closureLine}</p> : null}
              </td>
              <td>
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
              </td>
              <td>
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
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

const bookingChatHeaders = ['Relation', 'Booking', 'Payment', 'Chat archive', 'Action'] as const;

function PartnerBookingChatEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No booking records matched this date filter</strong>
      <p className="muted">{message}</p>
    </>
  );
}
