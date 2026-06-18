import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import type { PartnerOperatingLedgerRow } from './partner-detail-operating-ledger-model';

type PartnerDetailOperatingLedgerSectionProps = {
  readonly rows: readonly PartnerOperatingLedgerRow[];
};

const PARTNER_OPERATING_LEDGER_HEADERS = ['Area', 'Status', 'Evidence', 'Open'] as const;

export function PartnerDetailOperatingLedgerSection({ rows }: PartnerDetailOperatingLedgerSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-operating-ledger">
      <div className="ops-section-header">
        <div>
          <h2>Partner operating ledger</h2>
          <p className="muted">
            Compact factual ledger for identity, booking work, chat archive, service pricing, wallet,
            payout, tax, location, device, and audit evidence.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} record areas</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable emptyMessage={null} headers={PARTNER_OPERATING_LEDGER_HEADERS} rowCount={rows.length}>
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
    </div>
  );
}
