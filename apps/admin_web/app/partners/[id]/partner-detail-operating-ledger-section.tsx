import Link from 'next/link';

import { AdminTableScroll } from '../../../components/admin-data-table';
import type { PartnerOperatingLedgerRow } from './partner-detail-operating-ledger-model';

type PartnerDetailOperatingLedgerSectionProps = {
  readonly rows: readonly PartnerOperatingLedgerRow[];
};

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
        <table className="table">
          <thead>
            <tr>
              <th>Area</th>
              <th>Status</th>
              <th>Evidence</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </AdminTableScroll>
    </div>
  );
}
