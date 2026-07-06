import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge } from '../../../components/status-badge';
import type { PartnerFinanceFollowUpRow } from './partner-detail-finance-follow-up-model';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type PartnerDetailFinanceFollowUpSectionProps = {
  readonly rows: readonly PartnerFinanceFollowUpRow[];
};

const financeFollowUpHeaders = ['Item', 'Amount', 'Evidence', 'Action'] as const;

export function PartnerDetailFinanceFollowUpSection({
  rows,
}: PartnerDetailFinanceFollowUpSectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="One operator queue for withdrawal details, bank correction requests, negative-wallet recovery, and manual deposit evidence."
      id="partner-finance-follow-up"
      resultLabel={rows.length ? `${rows.length} active item(s)` : 'No active item'}
      resultTone={rows.some((row) => row.tone === 'danger') ? 'danger' : rows.length ? 'warning' : 'success'}
      title="Partner finance follow-up"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<PartnerFinanceFollowUpEmptyState />}
          headers={financeFollowUpHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <StatusBadge tone={row.tone}>{row.title}</StatusBadge>
                <p className="muted">{row.detail}</p>
              </td>
              <td>
                <strong>{row.amountLabel}</strong>
              </td>
              <td>
                <p className="muted">{row.evidenceLabel}</p>
              </td>
              <td>
                <AdminTextLink href={row.href}>
                  {row.actionLabel}
                </AdminTextLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

function PartnerFinanceFollowUpEmptyState() {
  return (
    <AdminEmptyState
      framed
      message="No bank correction, negative wallet, manual deposit, or withdrawal follow-up is active."
    />
  );
}
