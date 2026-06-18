import Link from 'next/link';
import type {
  PartnerChatRetentionRow,
  PartnerChatRetentionSummaryItem,
} from './partner-detail-chat-retention-model';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

export type { PartnerChatRetentionRow, PartnerChatRetentionSummaryItem };

type PartnerDetailChatRetentionLedgerSectionProps = {
  readonly description: string;
  readonly emptyMessage: string;
  readonly formatLatestMessageAt: (value: string) => string;
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
  formatLatestMessageAt,
  id,
  rows,
  statusPillClass,
  summary,
  title,
}: PartnerDetailChatRetentionLedgerSectionProps) {
  return (
    <div className="card admin-mb-16" id={id}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{rows.length} booking row(s)</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <AdminTableScroll>
        <AdminDataTable emptyMessage={null} headers={PARTNER_CHAT_RETENTION_HEADERS} rowCount={rows.length}>
          {rows.map((row) => (
            <tr key={`${row.id}-${row.relation}`}>
              <td>
                <strong>{row.bookingLabel}</strong>
                <p className="muted">{row.serviceLabel}</p>
                <span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>
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
                  {row.latestMessageAt ? formatLatestMessageAt(row.latestMessageAt) : 'No message date'}
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
                <Link className="text-link" href={row.bookingHref}>
                  Booking
                </Link>
                {row.chatHref ? (
                  <Link className="text-link admin-ml-10" href={row.chatHref}>
                    Archive
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {rows.length === 0 ? (
        <p className="muted admin-mt-12">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}
