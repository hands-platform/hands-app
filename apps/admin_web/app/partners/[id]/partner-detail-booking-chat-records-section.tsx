import Link from 'next/link';

import {
  AdminChatWindow,
  type AdminChatWindowMessage,
} from '../../../components/admin-chat-window';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminDisclosure, AdminNotePanel } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerBookingChatMessageRow = AdminChatWindowMessage;

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
                <StatusBadge tone={row.hasChatRoom ? 'success' : 'danger'}>
                  {row.relation}
                </StatusBadge>
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
                  <AdminDisclosure className="admin-chat-transcript-disclosure partner-chat-window-disclosure admin-mt-10">
                    <summary className="admin-chat-transcript-summary">
                      <div>
                        <strong>Admin chat archive</strong>
                        <p className="muted">
                          Mobile chat hides after service completion. Admin keeps this booking transcript.
                        </p>
                      </div>
                      <StatusBadge tone="info">{row.chatMessages.length} message(s)</StatusBadge>
                    </summary>
                    <AdminChatWindow
                      avatarLabel={row.customerLine}
                      emptyMessage="Chat room exists, but no message is stored yet."
                      messages={row.chatMessages}
                      subtitle={row.heading}
                      title="Booking chat evidence"
                    />
                  </AdminDisclosure>
                ) : (
                  <AdminNotePanel className="admin-mt-10">
                    <strong>Chat room missing</strong>
                    <p className="muted">
                      A matched booking should create a chat room. Open the booking detail if this booking
                      is already matched or in service.
                    </p>
                  </AdminNotePanel>
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
  return <AdminEmptyState message={message} title="No booking records matched this date filter" />;
}
