import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminTextLink } from '../../../components/admin-text-link';
import type { PartnerOperatingLedgerRow } from './partner-detail-operating-ledger-model';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type PartnerDetailOperatingLedgerSectionProps = {
  readonly rows: readonly PartnerOperatingLedgerRow[];
};

const PARTNER_OPERATING_LEDGER_HEADERS = ['Area', 'Status', 'Evidence', 'Open'] as const;

export function PartnerDetailOperatingLedgerSection({ rows }: PartnerDetailOperatingLedgerSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
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
                <AdminTextLink href={row.href}>
                  Open
                </AdminTextLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </PartnerDetailVuexyTablePanel>
  );
}
