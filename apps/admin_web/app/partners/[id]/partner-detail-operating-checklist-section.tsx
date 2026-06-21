import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type PartnerChecklistTone = 'blocked' | 'done' | 'pending';

export type PartnerOperatingChecklistRow = {
  readonly area: string;
  readonly detail: string;
  readonly href: string;
  readonly nextAction: string;
  readonly status: string;
  readonly tone: PartnerChecklistTone;
};

type PartnerDetailOperatingChecklistSectionProps = {
  readonly pillClassForTone: (tone: PartnerChecklistTone) => string;
  readonly rows: readonly PartnerOperatingChecklistRow[];
};

const operatingChecklistHeaders = ['Area', 'Status', 'Detail', 'Next Action', 'Action'];

export function PartnerDetailOperatingChecklistSection({
  pillClassForTone,
  rows,
}: PartnerDetailOperatingChecklistSectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Factual work-control checklist for support and operations. It shows whether bookings, payout, tax, location, and service setup need action."
      id="partner-operating-checklist"
      resultLabel={`${rows.length} check(s)`}
      title="Partner operating checklist"
    >
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={<PartnerOperatingChecklistEmptyState />}
            headers={operatingChecklistHeaders}
            rowCount={rows.length}
          >
            {rows.map((item) => (
              <tr key={item.area}>
                <td>
                  <strong>{item.area}</strong>
                </td>
                <td>
                  <span className={`pill ${pillClassForTone(item.tone)}`}>{item.status}</span>
                </td>
                <td>
                  <p className="muted">{item.detail}</p>
                </td>
                <td>
                  <span className={`pill ${pillClassForTone(item.tone)}`}>{item.nextAction}</span>
                </td>
                <td>
                  <Link className="text-link" href={item.href}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

function PartnerOperatingChecklistEmptyState() {
  return (
    <div className="empty-state">
      <strong>No records found</strong>
      <p className="muted">No partner operating checks are currently loaded.</p>
    </div>
  );
}
