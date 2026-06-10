import Link from 'next/link';

export type PartnerChatRetentionRow = {
  readonly adminRetention: string;
  readonly adminRetentionDetail: string;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly chatHref?: string;
  readonly hasRoom: boolean;
  readonly id: string;
  readonly latestMessage: string;
  readonly latestMessageAt?: string;
  readonly latestSender: string;
  readonly messageCount: number;
  readonly mobileHidden: boolean;
  readonly mobileVisibility: string;
  readonly mobileVisibilityDetail: string;
  readonly relation: string;
  readonly requiresRoom: boolean;
  readonly roleDetail: string;
  readonly roomDetail: string;
  readonly roomStatus: string;
  readonly serviceLabel: string;
  readonly status: string;
};

export type PartnerChatRetentionSummaryItem = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

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
    <div className="card" id={id} style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{rows.length} booking row(s)</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <table className="table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Booking</th>
            <th>Partner role</th>
            <th>Room state</th>
            <th>Latest message</th>
            <th>Mobile visibility</th>
            <th>Admin archive</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
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
                  <Link className="text-link" href={row.chatHref} style={{ marginLeft: 10 }}>
                    Archive
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}
