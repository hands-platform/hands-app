import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { DateTimeText } from '../../../components/date-time-text';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import type { PartnerOperationsDigestRow } from './partner-detail-operations-digest-model';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type { PartnerOperationsDigestRow };

type PartnerDetailOperationsDigestSectionProps = {
  readonly description: string;
  readonly id: string;
  readonly rows: readonly PartnerOperationsDigestRow[];
  readonly title: string;
};

const operationsDigestHeaders = ['Lane', 'Status', 'Detail', 'Evidence', 'Latest'];

export function PartnerDetailOperationsDigestSection({
  description,
  id,
  rows,
  title,
}: PartnerDetailOperationsDigestSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
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
                  <AdminTextLink href={row.href}>
                    {row.status}
                  </AdminTextLink>
                </td>
                <td>
                  <p className="muted">{row.detailNode ?? row.detail}</p>
                </td>
                <td>
                  <AdminFilterChipGroup ariaLabel={`${row.lane} digest evidence`}>
                    {row.evidence.map((item) => (
                      <StatusBadgeFromPillClass key={item} pillClass={row.tone}>
                        {item}
                      </StatusBadgeFromPillClass>
                    ))}
                  </AdminFilterChipGroup>
                </td>
                <td>
                  <small>
                    <DateTimeText fallback="No date" value={row.latestAt} />
                  </small>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <PartnerDetailVuexyTableFooter rowCount={rows.length} />
      </div>
    </PartnerDetailVuexyTablePanel>
  );
}
