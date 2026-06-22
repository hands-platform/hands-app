import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import type { PartnerOperatingLedgerRow } from './partner-detail-operating-ledger-model';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type PartnerDetailOperatingLedgerSectionProps = {
  readonly rows: readonly PartnerOperatingLedgerRow[];
};

const PARTNER_OPERATING_LEDGER_HEADERS = ['Area', 'Status', 'Evidence', 'Open'] as const;

export function PartnerDetailOperatingLedgerSection({ rows }: PartnerDetailOperatingLedgerSectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Compact factual ledger for identity, booking work, chat archive, service pricing, wallet, payout, location, device, and audit evidence."
      id="partner-operating-ledger"
      resultLabel={`${rows.length} record areas`}
      title="Partner operating ledger"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={null}
          headers={PARTNER_OPERATING_LEDGER_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.area}>
              <td>{row.area}</td>
              <td>{row.status}</td>
              <td>{row.evidence}</td>
              <td>
                <Link className="text-link" href={row.href}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}
