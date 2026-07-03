import { AdminDataTable } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { formatMoney } from '../../lib/admin-format';
import type { ServicePayoutLedgerRow } from '../../lib/service-payout-ledger-rows';
import { slugify } from '../../lib/service-catalog-filters';

type ServicePayoutLedgerSectionProps = {
  readonly activeServiceCount: number;
  readonly hiddenRowCount: number;
  readonly rows: readonly ServicePayoutLedgerRow[];
  readonly visibleRows: readonly ServicePayoutLedgerRow[];
};

const SERVICE_PAYOUT_LEDGER_HEADERS = [
  'Service option',
  'Customer price',
  'Partner payout',
  'Gross fee',
  'Tax / cost',
  'Actual company commission',
  'Partner visibility',
  'Next action',
] as const;

export function ServicePayoutLedgerSection({
  activeServiceCount,
  hiddenRowCount,
  rows,
  visibleRows,
}: ServicePayoutLedgerSectionProps) {
  return (
    <AdminSection
      bodyClassName="admin-table-section-body"
      className="admin-card-scroll admin-mb-16"
      description="Finance view for the current minimum price of every active duration option. This is the fastest way to confirm customer price, Partner payout, tax/cost assumptions, and customer-app visibility before Partners start selling."
      statusLabel={`${activeServiceCount} active option(s)`}
      statusTone="info"
      title="Service payout ledger"
    >
      <div className="admin-table-scroll">
        <AdminDataTable
          className="service-ledger"
          emptyMessage={null}
          headers={SERVICE_PAYOUT_LEDGER_HEADERS}
          rowCount={visibleRows.length}
        >
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
                  <small>{row.totalProviderRows} Partner price row(s)</small>
                </div>
              </td>
              <td>
                <span className={`pill ${row.actionTone}`}>{row.action}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </div>
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} active option(s). Full finance totals still
          include every active option.
        </p>
      ) : null}
    </AdminSection>
  );
}
