import type { ReactNode } from 'react';

import {
  AdminChatWindow,
  type AdminChatWindowMessage,
} from '../../../components/admin-chat-window';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminNotePanel } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTablePanel,
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerBookingChatMessageRow = AdminChatWindowMessage;

export type PartnerBookingChatRecordRow = {
  readonly bookingHref: string;
  readonly chatHref?: string;
  readonly chatLine: string;
  readonly chatMessages: readonly PartnerBookingChatMessageRow[];
  readonly closureLine?: string;
  readonly closureLineNode?: ReactNode;
  readonly customerHref?: string;
  readonly customerLine: string;
  readonly customerLineNode?: ReactNode;
  readonly hasChatRoom: boolean;
  readonly heading: string;
  readonly key: string;
  readonly paymentLine: string;
  readonly paymentLineNode?: ReactNode;
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
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Every matched booking should have a chat room. Completed service chats disappear from mobile apps, but the admin archive remains visible here."
      footer={
        <AdminTextLink href={openBookingsHref}>
          Open bookings
        </AdminTextLink>
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
                <p className="muted">{row.customerLineNode ?? row.customerLine}</p>
              </td>
              <td>
                <span className="muted">{row.paymentLineNode ?? row.paymentLine}</span>
                {row.closureLine || row.closureLineNode ? (
                  <p className="muted">{row.closureLineNode ?? row.closureLine}</p>
                ) : null}
              </td>
              <td>
                <p className="muted">{row.chatLine}</p>
                {row.hasChatRoom ? (
                  <div className="admin-chat-transcript-disclosure partner-chat-window-disclosure is-open admin-mt-10">
                    <div className="admin-chat-transcript-summary">
                      <div>
                        <strong>Admin chat archive</strong>
                        <p className="muted">
                          Mobile chat hides after service completion. Admin keeps this booking transcript.
                        </p>
                      </div>
                      <StatusBadge tone="info">{row.chatMessages.length} message(s)</StatusBadge>
                    </div>
                    <AdminChatWindow
                      avatarLabel={row.customerLine}
                      emptyMessage="Chat room exists, but no message is stored yet."
                      messages={row.chatMessages}
                      subtitle={row.heading}
                      title="Booking chat evidence"
                    />
                  </div>
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
                <AdminFilterChipGroup ariaLabel={`${row.heading} record actions`}>
                  <AdminTextLink href={row.bookingHref}>
                    Open booking
                  </AdminTextLink>
                  {row.customerHref ? (
                    <AdminTextLink href={row.customerHref}>
                      Open customer
                    </AdminTextLink>
                  ) : null}
                  {row.chatHref ? (
                    <AdminTextLink href={row.chatHref}>
                      Open chat archive
                    </AdminTextLink>
                  ) : null}
                </AdminFilterChipGroup>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </PartnerDetailVuexyTablePanel>
  );
}

const bookingChatHeaders = ['Relation', 'Booking', 'Payment', 'Chat archive', 'Action'] as const;

function PartnerBookingChatEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState message={message} title="No booking records matched this date filter" />;
}
