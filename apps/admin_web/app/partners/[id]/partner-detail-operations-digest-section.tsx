import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import type { PartnerOperationsDigestRow } from './partner-detail-operations-digest-model';

export type { PartnerOperationsDigestRow };

type PartnerDetailOperationsDigestSectionProps = {
  readonly description: string;
  readonly formatLatestAt: (value: string) => string;
  readonly id: string;
  readonly rows: readonly PartnerOperationsDigestRow[];
  readonly title: string;
};

const operationsDigestHeaders = ['Lane', 'Status', 'Detail', 'Evidence', 'Latest'];

export function PartnerDetailOperationsDigestSection({
  description,
  formatLatestAt,
  id,
  rows,
  title,
}: PartnerDetailOperationsDigestSectionProps) {
  return (
    <div className="card admin-mb-16" id={id}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{rows.length} lanes</span>
      </div>
      <div className="admin-mt-12">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerOperationsDigestEmptyState />}
            headers={operationsDigestHeaders}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.lane}>
                <td>
                  <strong>{row.lane}</strong>
                </td>
                <td>
                  <Link className="text-link" href={row.href}>
                    {row.status}
                  </Link>
                </td>
                <td>
                  <p className="muted">{row.detail}</p>
                </td>
                <td>
                  <div className="participant-list">
                    {row.evidence.map((item) => (
                      <span className={`pill ${row.tone}`} key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <small>{row.latestAt ? formatLatestAt(row.latestAt) : 'No date'}</small>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
    </div>
  );
}

function PartnerOperationsDigestEmptyState() {
  return (
    <div className="empty-state">
      <strong>No records found</strong>
      <p className="muted">No partner operations digest lanes are currently loaded.</p>
    </div>
  );
}
