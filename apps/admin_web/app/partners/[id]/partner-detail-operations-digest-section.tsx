import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import type { PartnerOperationsDigestRow } from './partner-detail-operations-digest-model';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description={description}
      id={id}
      resultLabel={`${rows.length} lanes`}
      title={title}
    >
      <div className="admin-mt-12">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={
              <AdminEmptyState framed message="No partner operations digest lanes are currently loaded." />
            }
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
        <PartnerDetailVuexyTableFooter rowCount={rows.length} />
      </div>
    </AdminFilterPanel>
  );
}
