import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
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

const operatingChecklistHeaders = ['Area', 'Readiness', 'Operator read', 'Next action', 'Open'];

export function PartnerDetailOperatingChecklistSection({
  pillClassForTone,
  rows,
}: PartnerDetailOperatingChecklistSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Compact active-work checklist for account hold, Level 2 approval, booking participation, service options, and app connection. Finance and withdrawal evidence stays in the dedicated wallet sections."
      id="partner-operating-checklist"
      resultLabel={`${rows.length} check(s)`}
      title="Partner active-work checklist"
    >
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={
              <AdminEmptyState framed message="No partner active-work checks are currently loaded." />
            }
            headers={operatingChecklistHeaders}
            rowCount={rows.length}
          >
            {rows.map((item) => (
              <tr key={item.area}>
                <td>
                  <strong>{item.area}</strong>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={pillClassForTone(item.tone)}>
                    {item.status}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <p className="muted">{item.detail}</p>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={pillClassForTone(item.tone)}>
                    {item.nextAction}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <AdminTextLink href={item.href}>
                    Open
                  </AdminTextLink>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </PartnerDetailVuexyTablePanel>
  );
}
