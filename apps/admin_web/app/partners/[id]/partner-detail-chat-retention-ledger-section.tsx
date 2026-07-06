import type {
  PartnerChatRetentionRow,
  PartnerChatRetentionSummaryItem,
} from './partner-detail-chat-retention-model';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { DateTimeText } from '../../../components/date-time-text';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type { PartnerChatRetentionRow, PartnerChatRetentionSummaryItem };

type PartnerDetailChatRetentionLedgerSectionProps = {
  readonly description: string;
  readonly emptyMessage: string;
  readonly id: string;
  readonly rows: readonly PartnerChatRetentionRow[];
  readonly statusPillClass: (status?: string) => string;
  readonly summary: readonly PartnerChatRetentionSummaryItem[];
  readonly title: string;
};

const PARTNER_CHAT_RETENTION_HEADERS = [
  'Booking',
  'Partner role',
  'Room state',
  'Latest message',
  'Mobile visibility',
  'Admin archive',
  'Open',
] as const;

export function PartnerDetailChatRetentionLedgerSection({
  description,
  emptyMessage,
  id,
  rows,
  statusPillClass,
  summary,
  title,
}: PartnerDetailChatRetentionLedgerSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description={description}
      id={id}
      resultLabel={`${rows.length} booking row(s)`}
      title={title}
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={null}
          headers={PARTNER_CHAT_RETENTION_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={`${row.id}-${row.relation}`}>
              <td>
                <strong>{row.bookingLabel}</strong>
                <p className="muted">{row.serviceLabel}</p>
                <StatusBadge tone={statusBadgeToneFromPillClass(statusPillClass(row.status))}>
                  {row.status}
                </StatusBadge>
              </td>
              <td>
                <strong>{row.relation}</strong>
                <p className="muted">{row.roleDetail}</p>
              </td>
              <td>
                <strong>{row.roomStatus}</strong>
                <p className="muted">{row.roomDetail}</p>
              </td>
              <td>
                <strong>{row.latestSender}</strong>
                <p className="muted">{row.latestMessage}</p>
                <small>
                  <DateTimeText fallback="No message date" value={row.latestMessageAt} />
                </small>
              </td>
              <td>
                <strong>{row.mobileVisibility}</strong>
                <p className="muted">{row.mobileVisibilityDetail}</p>
              </td>
              <td>
                <strong>{row.adminRetention}</strong>
                <p className="muted">{row.adminRetentionDetail}</p>
              </td>
              <td>
                <AdminTextLink href={row.bookingHref}>
                  Booking
                </AdminTextLink>
                {row.chatHref ? (
                  <AdminTextLink className="admin-ml-10" href={row.chatHref}>
                    Archive
                  </AdminTextLink>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
      {rows.length === 0 ? (
        <p className="muted admin-mt-12">
          {emptyMessage}
        </p>
      ) : null}
    </PartnerDetailVuexyTablePanel>
  );
}
