import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';

export type EarningsServiceBridgeItem = {
  readonly batchedCount: number;
  readonly bookingCount: number;
  readonly cashBookingCount: number;
  readonly cashDebtAmount: number;
  readonly currency: string;
  readonly grossAmount: number;
  readonly groupKey: string;
  readonly key: string;
  readonly label: string;
  readonly matrixBackedCount: number;
  readonly netAmount: number;
  readonly netCompanyFee: number;
  readonly otherCostAmount: number;
  readonly paidCount: number;
  readonly platformFee: number;
  readonly providerPayoutAmount: number;
  readonly unbatchedCount: number;
  readonly vatAmount: number;
  readonly withholdingAmount: number;
};

type EarningsServiceBridgeSectionProps = {
  readonly currency: string;
  readonly items: readonly EarningsServiceBridgeItem[];
};

export function EarningsServiceBridgeSection({ currency, items }: EarningsServiceBridgeSectionProps) {
  return (
    <AdminTablePanel
      description="Confirms which service duration options are creating Partner net, HANDS platform fee, tax withholding, cash wallet debt, and payout-batch pressure."
      resultLabel={`${items.length} option(s)`}
      resultTone={items.length > 0 ? 'info' : 'warning'}
      title="Service to earnings bridge"
    >
      <AdminFilterChipGroup ariaLabel="Earnings service bridge links" className="admin-mb-12">
        <AdminTextLink href="/services">
          Review service pricing
        </AdminTextLink>
      </AdminFilterChipGroup>
      <AdminTraceSummary
        defaultKind="record"
        defaultScope="Earning records"
        metrics={[
          { label: 'Service options', value: String(items.length) },
          {
            label: 'Gross',
            value: <MoneyText amount={sumBridge(items, 'grossAmount')} currency={currency} />,
          },
          {
            label: 'Partner net',
            value: <MoneyText amount={sumBridge(items, 'netAmount')} currency={currency} />,
          },
          {
            label: 'Partner payout',
            value: <MoneyText amount={sumBridge(items, 'providerPayoutAmount')} currency={currency} />,
          },
          {
            label: 'Platform fee',
            value: <MoneyText amount={sumBridge(items, 'platformFee')} currency={currency} />,
          },
          {
            label: 'VAT / cost',
            value: (
              <MoneyText
                amount={sumBridge(items, 'vatAmount') + sumBridge(items, 'otherCostAmount')}
                currency={currency}
              />
            ),
          },
          {
            label: 'Tax withheld',
            value: <MoneyText amount={sumBridge(items, 'withholdingAmount')} currency={currency} />,
          },
          {
            label: 'Cash debt',
            value: <MoneyText amount={sumBridge(items, 'cashDebtAmount')} currency={currency} />,
          },
        ]}
      />
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage="No earning has linked service details yet."
          headers={[
            'Service option',
            'Bookings',
            'Gross',
            'Partner payout',
            'Partner net',
            'Platform fee',
            'VAT / cost',
            'Tax withheld',
            'Net company fee',
            'Cash debt',
            'Payout state',
          ]}
          rowCount={items.length}
        >
            {items.map((item) => (
              <tr key={item.key}>
                <td>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.groupKey}</p>
                </td>
                <td>
                  <strong>{item.bookingCount}</strong>
                  <p className="muted">{item.cashBookingCount} cash booking(s)</p>
                </td>
                <td>
                  <MoneyText amount={item.grossAmount} currency={item.currency} />
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <strong>
                      <MoneyText amount={item.providerPayoutAmount} currency={item.currency} />
                    </strong>
                    <small>{item.matrixBackedCount} matrix-backed booking(s)</small>
                  </div>
                </td>
                <td>
                  <MoneyText amount={item.netAmount} currency={item.currency} />
                </td>
                <td>
                  <MoneyText amount={item.platformFee} currency={item.currency} />
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>
                      VAT <MoneyText amount={item.vatAmount} currency={item.currency} />
                    </small>
                    <small>
                      Cost <MoneyText amount={item.otherCostAmount} currency={item.currency} />
                    </small>
                  </div>
                </td>
                <td>
                  <MoneyText amount={item.withholdingAmount} currency={item.currency} />
                </td>
                <td>
                  <MoneyText amount={item.netCompanyFee} currency={item.currency} />
                </td>
                <td>
                  <StatusBadge tone={item.cashDebtAmount ? 'danger' : 'success'}>
                    <MoneyText amount={item.cashDebtAmount} currency={item.currency} />
                  </StatusBadge>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>{item.unbatchedCount} unbatched</small>
                    <small>{item.batchedCount} batched</small>
                    <small>{item.paidCount} paid</small>
                  </div>
                </td>
              </tr>
            ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminTablePanel>
  );
}

function sumBridge(items: readonly EarningsServiceBridgeItem[], key: keyof EarningsServiceBridgeItem) {
  return items.reduce((sum, item) => {
    const value = item[key];
    return typeof value === 'number' ? sum + value : sum;
  }, 0);
}
