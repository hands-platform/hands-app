import { formatMoney } from '../../lib/admin-format';
import type { ServicePayoutLedgerRow } from '../../lib/service-payout-ledger-rows';
import { slugify } from '../../lib/service-catalog-filters';

type ServicePayoutLedgerSectionProps = {
  readonly activeServiceCount: number;
  readonly hiddenRowCount: number;
  readonly rows: readonly ServicePayoutLedgerRow[];
  readonly visibleRows: readonly ServicePayoutLedgerRow[];
};

export function ServicePayoutLedgerSection({
  activeServiceCount,
  hiddenRowCount,
  rows,
  visibleRows,
}: ServicePayoutLedgerSectionProps) {
  return (
    <section className="card admin-card-scroll" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Service payout ledger</h2>
          <p className="muted">
            Finance view for the current minimum price of every active duration option. This is the fastest
            way to confirm customer price, partner payout, tax/cost assumptions, and customer-app visibility
            before partners start selling.
          </p>
        </div>
        <span className="pill pill-info">{activeServiceCount} active option(s)</span>
      </div>
      <table className="table service-ledger">
        <thead>
          <tr>
            <th>Service option</th>
            <th>Customer price</th>
            <th>Partner payout</th>
            <th>Gross fee</th>
            <th>Tax / cost</th>
            <th>Actual company commission</th>
            <th>Partner visibility</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.service.id}>
              <td>
                <strong>{row.service.name}</strong>
                <p className="muted">
                  {row.service.durationMin} min / {row.service.serviceGroupKey ?? slugify(row.service.name)}
                </p>
              </td>
              <td>{formatMoney(row.service.basePrice, row.currency)}</td>
              <td>{row.baseRule ? formatMoney(row.baseRule.providerPayoutAmount, row.currency) : '-'}</td>
              <td>{row.baseRule ? formatMoney(row.finance.fee, row.currency) : '-'}</td>
              <td>
                {row.baseRule ? (
                  <div className="service-matrix-cell">
                    <small>VAT {formatMoney(row.finance.vatAmount, row.currency)}</small>
                    <small>Withholding {formatMoney(row.finance.withholdingAmount, row.currency)}</small>
                    <small>Other {formatMoney(row.baseRule.otherCostAmount, row.currency)}</small>
                  </div>
                ) : (
                  '-'
                )}
              </td>
              <td>
                <span className={`pill ${row.commissionTone}`}>
                  {row.baseRule ? formatMoney(row.finance.actualCompanyCommission, row.currency) : 'Missing rule'}
                </span>
              </td>
              <td>
                <div className="service-matrix-cell">
                  <span className={`pill ${row.hiddenProviders ? 'pill-warn' : 'pill-success'}`}>
                    {row.visibleProviders} visible / {row.hiddenProviders} hidden
                  </span>
                  <small>{row.totalProviderRows} partner price row(s)</small>
                </div>
              </td>
              <td>
                <span className={`pill ${row.actionTone}`}>{row.action}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} active option(s). Full finance totals still
          include every active option.
        </p>
      ) : null}
    </section>
  );
}
