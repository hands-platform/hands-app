import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
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
    <AdminTableSection
      bodyClassName="admin-table-section-body"
      className="admin-mb-16"
      description="Finance view for the current minimum price of every active duration option. This is the fastest way to confirm customer price, Partner payout, tax/cost assumptions, and customer-app visibility before Partners start selling."
      scrollable
      statusLabel={`${activeServiceCount} active option(s)`}
      statusTone="info"
      title="Service payout ledger"
    >
      <AdminTableScroll>
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
              <td>
                <MoneyText amount={row.service.basePrice} currency={row.currency} />
              </td>
              <td>
                {row.baseRule ? (
                  <MoneyText amount={row.baseRule.providerPayoutAmount} currency={row.currency} />
                ) : (
                  '-'
                )}
              </td>
              <td>{row.baseRule ? <MoneyText amount={row.finance.fee} currency={row.currency} /> : '-'}</td>
              <td>
                {row.baseRule ? (
                  <div className="service-matrix-cell">
                    <small>
                      VAT <MoneyText amount={row.finance.vatAmount} currency={row.currency} />
                    </small>
                    <small>
                      Withholding{' '}
                      <MoneyText amount={row.finance.withholdingAmount} currency={row.currency} />
                    </small>
                    <small>
                      Other <MoneyText amount={row.baseRule.otherCostAmount} currency={row.currency} />
                    </small>
                  </div>
                ) : (
                  '-'
                )}
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(row.commissionTone)}>
                  {row.baseRule ? (
                    <MoneyText amount={row.finance.actualCompanyCommission} currency={row.currency} />
                  ) : (
                    'Missing rule'
                  )}
                </StatusBadge>
              </td>
              <td>
                <div className="service-matrix-cell">
                  <StatusBadge tone={row.hiddenProviders ? 'warning' : 'success'}>
                    {row.visibleProviders} visible / {row.hiddenProviders} hidden
                  </StatusBadge>
                  <small>{row.totalProviderRows} Partner price row(s)</small>
                </div>
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(row.actionTone)}>{row.action}</StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} active option(s). Full finance totals still
          include every active option.
        </p>
      ) : null}
    </AdminTableSection>
  );
}
